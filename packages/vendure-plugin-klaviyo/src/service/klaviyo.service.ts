import { Inject, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  ActiveOrderService,
  Collection,
  CollectionService,
  EventBus,
  Injector,
  JobQueue,
  JobQueueService,
  Logger,
  ProductPriceApplicator,
  ProductService,
  RequestContext,
  SerializedRequestContext,
  Translated,
  translateDeep,
  UserInputError,
} from '@vendure/core';
import { isAxiosError } from 'axios';
import {
  ApiKeySession,
  EventCreateQueryV2,
  EventsApi,
  ProfilesApi,
  CatalogsApi,
} from 'klaviyo-api';
import { PLUGIN_INIT_OPTIONS, loggerCtx } from '../constants';
import {
  EventWithContext,
  KlaviyoEventHandler,
  KlaviyoGenericEvent,
  KlaviyoOrderPlacedEvent,
} from '../event-handler/klaviyo-event-handler';
import { KlaviyoPluginOptions } from '../klaviyo.plugin';
import { KlaviyoProductFeedItem } from '../types';
import {
  mapToKlaviyoEventInput,
  mapToKlaviyoOrderPlacedInput,
  mapToOrderedProductEvent,
} from '../util/map-to-klaviyo-input';
import { CheckoutStartedEvent } from './checkout-started-event';

type JobData = {
  ctx: SerializedRequestContext;
  event: KlaviyoGenericEvent;
};

export class KlaviyoService implements OnApplicationBootstrap {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Weird TS error, but our JobData is JSON compatible
  private jobQueue!: JobQueue<any>;

  constructor(
    private readonly jobQueueService: JobQueueService,
    private readonly moduleRef: ModuleRef,
    @Inject(PLUGIN_INIT_OPTIONS) private readonly options: KlaviyoPluginOptions,
    private readonly eventBus: EventBus,
    private readonly productService: ProductService,
    private readonly activeOrderService: ActiveOrderService,
    private readonly collectionService: CollectionService,
    private readonly productPriceApplicator: ProductPriceApplicator
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Create JobQueue and handlers
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'klaviyo',
      process: async ({ data: _data }) => {
        const data = _data as JobData;
        const ctx = RequestContext.deserialize(data.ctx);
        try {
          await this.handleEventJob(ctx, data.event);
          Logger.info(
            `Successfully handled job '${data.event.eventName}'`,
            loggerCtx
          );
        } catch (e) {
          Logger.warn(
            `Failed to handle job '${data.event.eventName}': ${
              (e as Error).message
            }. Job data: ${JSON.stringify(data.event)}`,
            loggerCtx
          );
          throw e;
        }
      },
    });
    const eventHandlers = this.options.eventHandlers ?? [];
    if (eventHandlers.length === 0) {
      Logger.error(
        `No event handlers configured for Klaviyo. No events will be sent to Klaviyo. This means the plugin isn't doing anything.`,
        loggerCtx
      );
      return;
    }
    // Listen for configured event handlers
    eventHandlers.forEach((handler) => {
      this.eventBus.ofType(handler.vendureEvent).subscribe((event) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.createEventJob(event, handler).catch((err) => {
          Logger.error(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            `Error creating job for '${event?.constructor.name}' event: ${err}`,
            loggerCtx,
            (err as Error)?.stack
          );
        });
      });
    });
    Logger.info(
      `Listening for events: ${eventHandlers
        .map((e) => e.vendureEvent.name)
        .join(', ')}`,
      loggerCtx
    );
  }

  /**
   * Handle checkout started event - gets active order and publishes CheckoutStartedEvent
   */
  async handleCheckoutStarted(ctx: RequestContext): Promise<boolean> {
    const activeOrder = await this.activeOrderService.getActiveOrder(
      ctx,
      undefined
    );
    if (activeOrder) {
      await this.eventBus.publish(new CheckoutStartedEvent(ctx, activeOrder));
      Logger.info(
        `Published CheckoutStartedEvent for order ${activeOrder.code}`,
        loggerCtx
      );
      return true;
    }
    Logger.debug('No active order found for checkout started event', loggerCtx);
    return false;
  }

  /**
   * Create Jobs to sent events to Klaviyo based on the given Vendure event.
   * This calls the configured event handler for the event and sends the result to the job queue
   */
  async createEventJob<T extends EventWithContext>(
    vendureEvent: T,
    eventHandler: KlaviyoEventHandler<T>,
    retries = 10
  ): Promise<void> {
    const session = this.getKlaviyoSession(vendureEvent.ctx);
    if (!session) {
      Logger.debug(
        `No API key provided for Klaviyo, this means klaviyo is not enabled for channel '${vendureEvent.ctx.channel.token};`,
        loggerCtx
      );
      return;
    }
    const event = await eventHandler.mapToKlaviyoEvent(
      vendureEvent,
      new Injector(this.moduleRef)
    );
    if (event) {
      const jobData: JobData = {
        ctx: vendureEvent.ctx.serialize(),
        event,
      };
      await this.jobQueue.add(jobData, { retries });
    }
  }

  /**
   * Send events to Klaviyo
   */
  async handleEventJob(
    ctx: RequestContext,
    event: KlaviyoGenericEvent | KlaviyoOrderPlacedEvent
  ): Promise<void> {
    const session = this.getKlaviyoSession(ctx);
    if (!session) {
      return;
    }
    const klaviyoEventsApi = new EventsApi(session);
    if (event.eventName !== 'Order Placed') {
      // Anything other than Order Placed is handled as a generic Klaviyo event
      await this.createEvent(klaviyoEventsApi, mapToKlaviyoEventInput(event));
      Logger.info(
        `Sent '${event.eventName}' event with event ID '${event.uniqueId}' to Klaviyo.`,
        loggerCtx
      );
      return;
    }
    // This means we are dealing with an Order Placed event, and they require special handling
    // Push an order to Klaviyo as 'Placed Order Event' and create 'Ordered Product Events' for each order line
    const orderPlacedEvent = event as KlaviyoOrderPlacedEvent;
    await this.createEvent(
      klaviyoEventsApi,
      mapToKlaviyoOrderPlacedInput(orderPlacedEvent)
    );
    Logger.info(
      `Sent 'Placed Order' event to Klaviyo for order ${orderPlacedEvent.orderId}`,
      loggerCtx
    );
    for (const [index, orderItem] of orderPlacedEvent.orderItems.entries()) {
      if (orderItem.excludeFromOrderedProductEvent) {
        // Exclude this item from the Ordered Product event
        continue;
      }
      const orderedProductEvent = mapToOrderedProductEvent(
        orderItem,
        index,
        orderPlacedEvent
      );
      await this.createEvent(klaviyoEventsApi, orderedProductEvent);
    }
    Logger.info(
      `Sent 'Ordered Product' event to Klaviyo for order ${orderPlacedEvent.orderId} for ${orderPlacedEvent.orderItems.length} order lines`,
      loggerCtx
    );
  }

  getKlaviyoSession(ctx: RequestContext): ApiKeySession | undefined {
    const apiKey =
      typeof this.options.apiKey === 'function'
        ? this.options.apiKey(ctx)
        : this.options.apiKey;
    if (!apiKey) {
      // Klaviyo is disabled
      Logger.debug(
        `Klaviyo is disabled for channel '${ctx.channel.token}'`,
        loggerCtx
      );
      return;
    }
    return new ApiKeySession(apiKey);
  }

  /**
   * Creates an event in Klaviyo, but checks the response status code and throws an error if it's not 2xx
   */
  async createEvent(
    klaviyoEventsApi: EventsApi,
    event: EventCreateQueryV2
  ): Promise<void> {
    try {
      const {
        response: { status, statusText },
      } = await klaviyoEventsApi.createEvent(event);
      if (status < 200 || status > 299) {
        throw new Error(
          `[${loggerCtx}]: Failed to create event '${event.data.attributes.metric.data.attributes.name}': ${statusText} (${status})`
        );
      }
    } catch (e: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (isAxiosError(e) && e.response?.data?.errors[0]?.detail) {
        // Throw more specific Klaviyo error if available

        throw Error(
          // eslint-disable-next-line
          e.response?.data.errors.map((error: any) => error?.detail)?.join(', ')
        );
      } else {
        throw e;
      }
    }
  }

  /**
   * Subscribe email address to list. Still requires the user to confirm via email they receive from Klaviyo (double opt in)
   */
  async subscribeToList(
    ctx: RequestContext,
    emailAddress: string,
    listId: string
  ): Promise<void> {
    const session = this.getKlaviyoSession(ctx);
    if (!session) {
      throw new UserInputError('Klaviyo is not enabled');
    }
    const klaviyoApi = new ProfilesApi(session);
    await klaviyoApi.subscribeProfiles({
      data: {
        type: 'profile-subscription-bulk-create-job',
        attributes: {
          profiles: {
            data: [
              {
                type: 'profile',
                attributes: {
                  email: emailAddress,
                  subscriptions: {
                    email: {
                      marketing: {
                        consent: 'SUBSCRIBED',
                      },
                    },
                  },
                },
              },
            ],
          },
        },
        relationships: {
          list: {
            data: {
              id: listId,
              type: 'list',
            },
          },
        },
      },
    });
    Logger.info(`Subscribed '${emailAddress}' to list '${listId}'`);
  }

  /**
   * Subscribe email address for back in stock notification for the given catalog item.
   */
  async subscribeToBackInStock(
    ctx: RequestContext,
    emailAddress: string,
    catalogItemId: string
  ): Promise<void> {
    const session = this.getKlaviyoSession(ctx);
    if (!session) {
      throw new UserInputError('Klaviyo is not enabled');
    }
    const klaviyoApi = new CatalogsApi(session);
    await klaviyoApi.createBackInStockSubscription({
      data: {
        type: 'back-in-stock-subscription',
        attributes: {
          profile: {
            data: {
              type: 'profile',
              attributes: {
                email: emailAddress,
              },
            },
          },
          channels: ['EMAIL'],
        },
        relationships: {
          variant: {
            data: {
              type: 'catalog-variant',
              // $custom is for custom API, and $default is standard when you only use 1 feed
              id: `$custom:::$default:::${catalogItemId}`,
            },
          },
        },
      },
    });
    Logger.info(
      `Subscribed '${emailAddress}' to back in stock for catalog item (usually variant) '${catalogItemId}'`
    );
  }

  async getProductFeed(ctx: RequestContext): Promise<KlaviyoProductFeedItem[]> {
    if (!this.options.feed) {
      throw new Error(
        'Product feed is not enabled. Set the feed option in the plugin config.'
      );
    }
    const productFeed: KlaviyoProductFeedItem[] = [];
    let skip = 0;
    const take = 100;
    let hasMore = true;
    Logger.info('Starting to build Klaviyo product feed...', loggerCtx);
    const allCollections = await this.getAllCollections(ctx);
    while (hasMore) {
      Logger.verbose(
        `Fetching product variants from ${skip} to ${
          skip + take
        } for channel '${ctx.channel.token}'`,
        loggerCtx
      );
      const { items: products } = await this.productService.findAll(
        ctx,
        {
          skip,
          take,
          filter: {
            enabled: { eq: true },
            deletedAt: { isNull: true },
          },
        },
        [
          'variants.collections',
          'variants.productVariantPrices',
          'variants.stockLevels',
          'variants.featuredAsset',
          'variants.taxCategory',
          'featuredAsset',
        ]
      );
      // Map all product.variants to Translated<ProductVariant> with the product attached
      const allVariants = products.flatMap((product) =>
        product.variants
          .filter((variant) => variant.enabled)
          .map((variant) => {
            variant.product = product;
            return variant;
          })
      );
      // Transform variants to Klaviyo product feed items
      for (const variant of allVariants) {
        // Apply prices
        let enhancedVariant =
          await this.productPriceApplicator.applyChannelPriceAndTax(
            variant,
            ctx,
            undefined,
            false
          );
        enhancedVariant = translateDeep(enhancedVariant, ctx.languageCode);
        enhancedVariant.collections = enhancedVariant.collections
          .map((c) => allCollections.find((col) => col.id === c.id))
          .filter(Boolean) as Translated<Collection>[];
        // Calculate variant stock level
        let variantStocklevel = 0;
        variant.stockLevels.forEach((stockLocation) => {
          const stockLevelStockOnHand =
            stockLocation.stockOnHand - stockLocation.stockAllocated;
          if (stockLevelStockOnHand > 0) {
            // Only sum up stock levels that are positive, ignore any location that have negative stock
            variantStocklevel += stockLevelStockOnHand;
          }
        });
        // Create Klaviyo product feed item based on configured strategy
        const feedItem = this.options.feed.enhanceProductFeedItemFn(
          ctx,
          enhancedVariant,
          {
            id: String(enhancedVariant.id),
            title: enhancedVariant.name,
            description: enhancedVariant.product.description,
            price: enhancedVariant.priceWithTax / 100,
            categories: enhancedVariant.collections.map((c) => c.name),
            inventory_quantity: variantStocklevel,
            inventory_policy: 1,
          }
        );
        productFeed.push(feedItem);
      }

      skip += take;
      hasMore = products.length === take;

      Logger.verbose(
        `Processed ${allVariants.length} variants, total feed items: ${productFeed.length}`,
        loggerCtx
      );
    }
    Logger.info(
      `Completed Klaviyo product feed with ${productFeed.length} items for channel '${ctx.channel.token}'`,
      loggerCtx
    );

    return productFeed;
  }

  private async getAllCollections(ctx: RequestContext): Promise<Collection[]> {
    const allCollections = [];
    let skip = 0;
    const take = 100;
    let hasMore = true;
    while (hasMore) {
      const collections = await this.collectionService.findAll(
        ctx,
        {
          skip,
          take,
        },
        []
      );
      allCollections.push(...collections.items);
      skip += take;
      hasMore = collections.items.length === take;
    }
    return allCollections;
  }
}
