import { Inject, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  EventBus,
  Injector,
  JobQueue,
  JobQueueService,
  Logger,
  RequestContext,
  SerializedRequestContext,
} from '@vendure/core';
import { isAxiosError } from 'axios';
import {
  ApiKeySession,
  EventCreateQueryV2,
  EventsApi,
  ProfilesApi,
} from 'klaviyo-api';
import { PLUGIN_INIT_OPTIONS, loggerCtx } from '../constants';
import {
  EventWithContext,
  KlaviyoEventHandler,
  KlaviyoGenericEvent,
  KlaviyoOrderPlacedEvent,
} from '../event-handler/klaviyo-event-handler';
import { KlaviyoPluginOptions } from '../klaviyo.plugin';
import {
  mapToKlaviyoEventInput,
  mapToKlaviyoOrderPlacedInput,
  mapToOrderedProductEvent,
} from '../util/map-to-klaviyo-input';

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
    private readonly eventBus: EventBus
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
    if (this.options.eventHandlers.length === 0) {
      Logger.error(
        `No event handlers configured for Klaviyo. No events will be sent to Klaviyo. This means the plugin isn't doing anything.`,
        loggerCtx
      );
      return;
    }
    // Listen for configured event handlers
    this.options.eventHandlers.forEach((handler) => {
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
      `Listening for events: ${this.options.eventHandlers
        .map((e) => e.vendureEvent.name)
        .join(', ')}`,
      loggerCtx
    );
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
    const session = await this.getKlaviyoSession(vendureEvent.ctx);
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
    const session = await this.getKlaviyoSession(ctx);
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

  // eslint-disable-next-line @typescript-eslint/require-await
  async getKlaviyoSession(
    ctx: RequestContext
  ): Promise<ApiKeySession | undefined> {
    const apiKey =
      typeof this.options.apiKey === 'function'
        ? this.options.apiKey(ctx)
        : this.options.apiKey;
    if (!apiKey) {
      // Klaviyo is disabled
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
    const session = await this.getKlaviyoSession(ctx);
    if (!session) {
      return;
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
}
