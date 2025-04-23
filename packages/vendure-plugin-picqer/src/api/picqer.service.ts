import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
  OrderAddress,
  UpdateProductVariantInput,
} from '@vendure/common/lib/generated-types';
import {
  Address,
  AssetService,
  ChannelService,
  ConfigService,
  Customer,
  EntityHydrator,
  ErrorResult,
  EventBus,
  ForbiddenError,
  ID,
  JobQueue,
  JobQueueService,
  Logger,
  Order,
  OrderPlacedEvent,
  OrderService,
  OrderStateTransitionError,
  ProductVariant,
  ProductVariantEvent,
  ProductVariantService,
  RequestContext,
  SerializedRequestContext,
  StockLevel,
  StockLevelService,
  StockLocation,
  StockLocationService,
  StockMovementEvent,
  TransactionalConnection,
} from '@vendure/core';
import { StockAdjustment } from '@vendure/core/dist/entity/stock-movement/stock-adjustment.entity';
import currency from 'currency.js';
import util from 'util';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { PicqerOptions } from '../picqer.plugin';
import {
  PicqerConfig,
  PicqerConfigInput,
  TestPicqerInput,
} from '../ui/generated/graphql';
import { PicqerConfigEntity } from './picqer-config.entity';
import { PicqerClient, PicqerClientInput } from './picqer.client';
import { picqerHandler } from './picqer.handler';
import {
  AddressInput,
  CustomerData,
  CustomerInput,
  IncomingWebhook,
  OrderData,
  OrderInput,
  OrderProductInput,
  ProductData,
  ProductInput,
  WebhookEvent,
} from './types';

/**
 * Job to push variants from Vendure to Picqer
 */
interface PushVariantsJob {
  action: 'push-variants';
  ctx: SerializedRequestContext;
  variantIds: ID[];
}

/**
 * Job to pull stock levels from Picqer into Vendure
 */
interface PullStockLevelsJob {
  action: 'pull-stock-levels';
  ctx: SerializedRequestContext;
}

/**
 * Job to push orders to Picqer
 */
interface PushOrderJob {
  action: 'push-order';
  ctx: SerializedRequestContext;
  orderId: ID;
}

type JobData = PushVariantsJob | PullStockLevelsJob | PushOrderJob;

@Injectable()
export class PicqerService implements OnApplicationBootstrap {
  private jobQueue!: JobQueue<JobData>;

  constructor(
    @Inject(PLUGIN_INIT_OPTIONS) private options: PicqerOptions,
    private eventBus: EventBus,
    private jobQueueService: JobQueueService,
    private connection: TransactionalConnection,
    private variantService: ProductVariantService,
    private assetService: AssetService,
    private configService: ConfigService,
    private entityHydrator: EntityHydrator,
    private channelService: ChannelService,
    private orderService: OrderService,
    private stockLocationService: StockLocationService,
    private stockLevelService: StockLevelService
  ) {}

  async onApplicationBootstrap() {
    // Create JobQueue and handlers
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'picqer-sync',
      process: async ({ data }) => {
        const ctx = RequestContext.deserialize(data.ctx);
        if (data.action === 'push-variants') {
          await this.handlePushVariantsJob(ctx, data.variantIds).catch(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (e: any) => {
              throw Error(
                `Failed to push variants to Picqer (variants: ${data.variantIds?.join(
                  ','
                  // eslint-disable-next-line  @typescript-eslint/no-unsafe-member-access
                )}): ${e?.message}`
              );
            }
          );
        } else if (data.action === 'pull-stock-levels') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await this.handlePullStockLevelsJob(ctx).catch((e: any) => {
            throw Error(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              `Failed to pull stock levels from  Picqer: ${e?.message}`
            );
          });
        } else if (data.action === 'push-order') {
          const order = await this.orderService.findOne(ctx, data.orderId);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await this.handlePushOrderJob(ctx, data.orderId).catch((e: any) => {
            throw Error(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              `Failed to push order ${order?.code} (${data.orderId}) to Picqer: ${e?.message}`
            );
          });
        } else {
          Logger.error(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            `Invalid job action: ${(data as any).action}`,
            loggerCtx
          );
        }
        Logger.info(`Successfully handled job '${data.action}'`, loggerCtx);
      },
    });
    // Listen for Variant creation or update
    this.eventBus
      .ofType(ProductVariantEvent)
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      .subscribe(async ({ ctx, entity: entities, type, input }) => {
        if (type !== 'created' && type !== 'updated') {
          // Ignore anything other than creation or update
          return;
        }
        // Only update in Picqer if one of these fields was updated
        const shouldUpdate = (input as UpdateProductVariantInput[])?.some(
          (v) =>
            v.translations ??
            v.price ??
            v.taxCategoryId ??
            (this.options.shouldSyncOnProductVariantCustomFields ?? []).some(
              (customFieldName) =>
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                v.customFields ? v.customFields[customFieldName] : false
            )
        );
        if (!shouldUpdate) {
          Logger.info(
            `No relevant changes to variants ${JSON.stringify(
              entities.map((v) => v.sku)
            )}, not pushing to Picqer`,
            loggerCtx
          );
          return;
        }
        await this.addPushVariantsJob(
          ctx,
          entities.map((v) => v.id)
        );
      });
    // Listen for Order placed events
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async ({ ctx, order }) => {
      await this.addPushOrderJob(ctx, order);
    });
    // Register webhooks on app start
    for (const config of await this.getAllConfigs()) {
      const ctx = await this.getCtxForChannel(config.channelId);
      await this.registerWebhooks(ctx, config).catch((e) =>
        Logger.error(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `Failed to register webhooks for channel ${ctx.channel.token}: ${e?.message}`,
          loggerCtx
        )
      );
    }
  }

  /**
   * Checks if webhooks for events exist in Picqer, if not, register new webhooks.
   * When hooks exist, but url or secret is different, it will create new hooks.
   *
   * Registers hooks for: products.free_stock_changed and orders.completed
   */
  async registerWebhooks(
    ctx: RequestContext,
    config: PicqerConfig
  ): Promise<void> {
    const hookUrl = `${this.options.vendureHost}/picqer/hooks/${ctx.channel.token}`;
    const client = await this.getClient(ctx, config);
    if (!client) {
      return;
    }
    const eventsToRegister: WebhookEvent[] = [
      'orders.status_changed',
      'products.free_stock_changed',
      'products.assembled_stock_changed',
    ];
    const webhooks = await client.getWebhooks();
    for (const hookEvent of eventsToRegister) {
      // Use first 4 digits of webhook secret as name, so we can identify the hook
      const webhookName = `Vendure ${client.webhookSecret.slice(0, 4)}`;
      let hook = webhooks.find(
        (h) =>
          h.event === hookEvent && h.address === hookUrl && h.active === true
      );
      if (hook && hook.name !== webhookName) {
        // A hook exists, but the name is different, that means the secret changed. We need to create a new hook
        // The combination of hook address and hook event must be unique in picqer
        Logger.info(`Deactivating outdated hook ${hook.name}`);
        await client.deactivateHook(hook.idhook);
        hook = undefined; // Set as undefined, because we deactivated the previous one
      }
      if (!hook) {
        const webhook = await client.createWebhook({
          name: webhookName,
          address: hookUrl,
          event: hookEvent,
          secret: client.webhookSecret,
        });
        Logger.info(
          `Registered hook (id: ${webhook.idhook}) for event ${hookEvent} and url ${hookUrl}`,
          loggerCtx
        );
      }
    }
    Logger.info(
      `Registered webhooks for channel ${ctx.channel.token}`,
      loggerCtx
    );
  }

  /**
   * Handle incoming webhooks
   */
  async handleHook(input: {
    channelToken: string;
    body: IncomingWebhook;
    rawBody: string;
    signature: string;
  }): Promise<void> {
    // Get client for channelToken
    const ctx = await this.getCtxForChannel(input.channelToken);
    const client = await this.getClient(ctx);
    if (!client) {
      Logger.error(
        `No client found for channel ${input.channelToken}`,
        loggerCtx
      );
      return;
    }
    // Verify signature
    if (!client.isSignatureValid(input.rawBody, input.signature)) {
      Logger.error(
        `Invalid signature for incoming webhook ${input.body.event} channel ${input.channelToken}`,
        loggerCtx
      );
      throw new ForbiddenError();
    }
    if (
      input.body.event === 'products.free_stock_changed' ||
      input.body.event === 'products.assembled_stock_changed'
    ) {
      await this.updateStockBySkus(ctx, [input.body.data]);
    } else if (input.body.event === 'orders.status_changed') {
      await this.handleOrderStatusChanged(ctx, input.body.data);
    } else {
      Logger.warn(
        `Unknown event ${
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
          (input.body as any).event
        } for incoming webhook for channel ${
          input.channelToken
        }. Not handling this webhook...`,
        loggerCtx
      );
      return;
    }
    Logger.info(`Successfully handled hook ${input.body.event}`, loggerCtx);
  }

  /**
   * Create jobs to push all Vendure variants as products to Picqer
   */
  async createPushProductsJob(ctx: RequestContext): Promise<void> {
    const variantIds: ID[] = [];
    let skip = 0;
    const take = 1000;
    let hasMore = true;
    while (hasMore) {
      // Only fetch IDs, not the whole entities
      const [variants, count] = await this.connection
        .getRepository(ctx, ProductVariant)
        .createQueryBuilder('variant')
        .select(['variant.id'])
        .leftJoin('variant.channels', 'channel')
        .leftJoin('variant.product', 'product')
        .where('channel.id = :channelId', { channelId: ctx.channelId })
        .andWhere('variant.deletedAt IS NULL')
        .andWhere('variant.enabled = true')
        .andWhere('product.deletedAt IS NULL')
        .andWhere('product.enabled is true')
        .skip(skip)
        .take(take)
        .getManyAndCount();
      variantIds.push(...variants.map((v) => v.id));
      if (variantIds.length >= count) {
        hasMore = false;
      }
      skip += take;
    }
    // Create batches
    const batchSize = 10;
    while (variantIds.length) {
      await this.addPushVariantsJob(ctx, variantIds.splice(0, batchSize));
    }
  }

  /**
   * Create job to pull stock levels of all products from Picqer
   */
  async createStockLevelJob(ctx: RequestContext): Promise<void> {
    await this.jobQueue.add(
      {
        action: 'pull-stock-levels',
        ctx: ctx.serialize(),
      },
      { retries: 10 }
    );
    Logger.info(`Added 'pull-stock-levels' job to queue`, loggerCtx);
  }

  /**
   * Move an order to Delivered or Cancelled based on the incoming webhook
   */
  async handleOrderStatusChanged(ctx: RequestContext, data: OrderData) {
    const order = await this.orderService.findOneByCode(ctx, data.reference, [
      'lines',
      'lines.productVariant',
    ]);
    if (!order) {
      Logger.warn(
        `No order found for code ${data.reference}. Not processing this hook any further`,
        loggerCtx
      );
      return;
    }
    if (
      data.status === 'cancelled' &&
      order.state !== 'Cancelled' &&
      this.options.cancelOrdersOnPicqerCancellation
    ) {
      const result = await this.orderService.cancelOrder(ctx, {
        orderId: order.id,
        reason: 'Cancelled in Picqer',
        cancelShipping: true,
      });
      if ((result as ErrorResult).errorCode) {
        Logger.error(
          `Failed to cancel order ${order.code}: ${
            (result as ErrorResult).message
          }. Ensure the order process is configured with "checkFulfillmentStates: false"`,
          loggerCtx,
          util.inspect(result)
        );
        return;
      }
      Logger.info(`Cancelled order ${order.code}`, loggerCtx);
      return;
    }
    if (
      data.status === 'completed' &&
      order.state !== 'Delivered' &&
      order.state !== 'Cancelled'
    ) {
      // Order should be transitioned to Shipped and then to Delivered
      try {
        await this.transitionToState(ctx, order, 'Shipped');
        await this.transitionToState(ctx, order, 'Delivered');
      } catch (e) {
        Logger.error(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Failed to transition order ${order.code}: ${e}`,
          loggerCtx,
          util.inspect(e)
        );
        return;
      }
    }
    Logger.info(
      `Not handling incoming status '${data.status}' because order ${order.code} is already '${order.state}'`,
      loggerCtx
    );
  }

  async transitionToState(
    ctx: RequestContext,
    order: Order,
    state: 'Shipped' | 'Delivered'
  ) {
    const result = await this.orderService.transitionToState(
      ctx,
      order.id,
      state
    );
    const errorResult = result as OrderStateTransitionError;
    if (errorResult.errorCode) {
      Logger.error(
        `Failed to transition order ${order.code} to ${state}: ${errorResult.message}`,
        loggerCtx,
        util.inspect(errorResult)
      );
      throw errorResult;
    }
  }

  /**
   * Add a job to the queue to push variants to Picqer
   */
  async addPushVariantsJob(
    ctx: RequestContext,
    variantIds: ID[]
  ): Promise<void> {
    await this.jobQueue.add(
      {
        action: 'push-variants',
        ctx: ctx.serialize(),
        variantIds,
      },
      { retries: 10 }
    );
    Logger.info(
      `Added job to the 'push-variants' queue for ${variantIds.length} variants for channel ${ctx.channel.token}`,
      loggerCtx
    );
  }

  /**
   * Add a job to the queue to push orders to Picqer
   */
  async addPushOrderJob(ctx: RequestContext, order: Order): Promise<void> {
    await this.jobQueue
      .add(
        {
          action: 'push-order',
          ctx: ctx.serialize(),
          orderId: order.id,
        },
        { retries: 10 }
      )
      .catch((e) => {
        Logger.error(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `Failed to add job to 'push-order' queue for order ${order.code}: ${e?.message}`,
          loggerCtx
        );
        throw e;
      });
    Logger.info(
      `Added job to the 'push-order' queue for order ${order.code}`,
      loggerCtx
    );
  }

  /**
   * Sync warehouses, pull all products from Picqer and updates the stock levels in Vendure
   * based on the stock levels from Picqer products
   */
  async handlePullStockLevelsJob(userCtx: RequestContext): Promise<void> {
    const ctx = this.createDefaultLanguageContext(userCtx);
    const client = await this.getClient(ctx);
    if (!client) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.syncWarehouses(ctx).catch((e: any) => {
      Logger.error(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Failed to sync warehouses with Picqer: ${e?.message}`,
        loggerCtx,
        util.inspect(e)
      );
    });
    const picqerProducts = await client.getAllActiveProducts();
    await this.updateStockBySkus(ctx, picqerProducts);
    Logger.info(`Successfully pulled stock levels from Picqer`, loggerCtx);
  }

  /**
   * Fetch warehouses from Picqer and save as stock location in Vendure
   * Deletes any warehouses from Vendure that are not active in Picqer
   */
  async syncWarehouses(ctx: RequestContext): Promise<void> {
    const client = await this.getClient(ctx);
    if (!client) {
      return;
    }
    // List of Vendure location ID's that are created/updated based on Picqer warehouses
    const syncedFromPicqer: ID[] = [];
    const warehouses = await client.getAllWarehouses();
    for (const warehouse of warehouses) {
      const existing = await this.getStockLocation(ctx, warehouse.idwarehouse);
      if (!warehouse.active) {
        continue;
      }
      const stockLocationName = `Picqer ${warehouse.idwarehouse}: ${warehouse.name}`;
      const stocklocationDescription = `Mirrored warehouse from Picqer '${warehouse.name}' (${warehouse.idwarehouse})`;
      if (existing) {
        await this.stockLocationService.update(ctx, {
          id: existing.id,
          name: stockLocationName,
          description: stocklocationDescription,
        });
        syncedFromPicqer.push(existing.id);
        Logger.info(`Updated stock location '${stockLocationName}'`, loggerCtx);
      } else {
        const created = await this.stockLocationService.create(ctx, {
          name: stockLocationName,
          description: stocklocationDescription,
        });
        syncedFromPicqer.push(created.id);
        Logger.info(
          `Created new stock location '${stockLocationName}'`,
          loggerCtx
        );
      }
    }
    // Delete non-picqer warehouses
    const locations = await this.stockLocationService.findAll(ctx);
    // Delete locations that are not Picqer based
    const locationsToDelete = locations.items.filter(
      (l) => !syncedFromPicqer.includes(l.id)
    );
    for (const location of locationsToDelete) {
      const res = await this.stockLocationService.delete(ctx, {
        id: location.id,
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      if (res.result === 'DELETED') {
        Logger.info(`Deleted stock location ${location.name}`, loggerCtx);
      } else {
        Logger.error(
          `Failed to delete stock location ${location.name}: ${res.message}`,
          loggerCtx
        );
      }
    }
    Logger.info(`Successfully synced warehouses from Picqer`, loggerCtx);
  }

  /**
   * Get stock locations based on the stock locations we receive from Picqer
   * @returns The Vendure stock location that mirrors the Picqer warehouse
   */
  async getStockLocation(
    ctx: RequestContext,
    picqerLocationId: number
  ): Promise<StockLocation | undefined> {
    // Picqer location ID's are also used as the ID of the Vendure stock location
    // return await this.stockLocationService.findOne(ctx, picqerLocationId);
    const { items } = await this.stockLocationService.findAll(ctx, {
      filter: {
        name: { contains: `Picqer ${picqerLocationId}` },
      },
    });
    const location = items[0];
    if (items.length > 1) {
      Logger.error(
        `Found multiple locations with name "Picqer ${picqerLocationId}", there should be only one! Using location with ID ${location.id}`,
        loggerCtx
      );
    }
    return location;
  }

  /**
   * Update variant stock in Vendure based on given Picqer products
   */
  async updateStockBySkus(
    ctx: RequestContext,
    picqerProducts: ProductData[]
  ): Promise<void> {
    const vendureVariants = await this.findAllVariantsBySku(
      ctx,
      picqerProducts.map((p) => p.productcode)
    );
    const stockAdjustments: StockAdjustment[] = [];
    // Loop over variants to determine new stock level per variant and update in DB
    await Promise.all(
      vendureVariants.map(async (variant) => {
        const picqerProduct = picqerProducts.find(
          (p) => p.productcode === variant.sku
        );
        if (!picqerProduct) {
          // Should never happen, because we only fetch variants that were given in the Picqer products payload
          Logger.error(
            `No Picqer product found for variant ${variant.sku}`,
            loggerCtx
          );
          return;
        }
        if (picqerProduct.unlimitedstock) {
          Logger.info(
            `Not updating stock of variant '${variant.sku}', because it has unlimited stock in Picqer`,
            loggerCtx
          );
          return;
        }
        // Fields from picqer that should be added to the variant
        let additionalVariantFields = {};
        try {
          additionalVariantFields =
            this.options.pullPicqerProductFields?.(picqerProduct) || {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
          Logger.error(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            `Failed to get additional fields from the configured pullFieldsFromPicqer function: ${e?.message}`,
            loggerCtx
          );
        }
        // Update the actual variant in Vendure, with raw connection for better performance
        await this.connection
          .getRepository(ctx, ProductVariant)
          .update({ id: variant.id }, additionalVariantFields);
        // Write stock level per location per variant
        for (const picqerStock of picqerProduct.stock) {
          if (!picqerStock.idwarehouse) {
            Logger.error(
              `Can not update stock for picqer warehouse without id`,
              loggerCtx
            );
            continue;
          }
          const location = await this.getStockLocation(
            ctx,
            picqerStock.idwarehouse
          );
          if (!location) {
            Logger.info(
              `Not updating stock of warehouse ${picqerStock.idwarehouse}, because it doesn't exist in Vendure. You might need to re-sync stock levels and locations if this is an active warehouse.`
            );
            continue;
          }
          const { id: stockLevelId, stockOnHand } =
            await this.stockLevelService.getStockLevel(
              ctx,
              variant.id,
              location.id
            );
          const allocated = picqerStock.reservedallocations ?? 0;
          const newStockOnHand = allocated + picqerStock.freestock;
          const delta = newStockOnHand - stockOnHand;
          await this.connection.getRepository(ctx, StockLevel).save({
            id: stockLevelId,
            stockOnHand: picqerStock.freestock,
            stockAllocated: 0, // Reset allocations, because we skip fulfillment with this plugin
          });
          // Add stock adjustment
          stockAdjustments.push(
            new StockAdjustment({
              quantity: delta,
              productVariant: { id: variant.id },
            })
          );
        }
      })
    );
    if (!stockAdjustments.length) {
      Logger.warn(
        `No stock levels updated. This means none of the products in Picqer exist in Vendure yet.`,
        loggerCtx
      );
      return;
    }
    await this.eventBus.publish(new StockMovementEvent(ctx, stockAdjustments));
    Logger.info(
      `Updated stock levels of ${stockAdjustments.length} variants`,
      loggerCtx
    );
  }

  /**
   * Fulfil the order first, then pushes the order to Picqer
   */
  async handlePushOrderJob(ctx: RequestContext, orderId: ID): Promise<void> {
    const client = await this.getClient(ctx);
    if (!client) {
      // This means Picqer is not configured, so ignore this job
      return;
    }
    const order = await this.orderService.findOne(ctx, orderId, [
      'lines',
      'lines.productVariant',
      'lines.productVariant.translations',
      'lines.productVariant.taxCategory',
      'lines.productVariant.product',
      'customer',
      'customer.addresses',
      'shippingLines',
      'shippingLines.shippingMethod',
    ]);
    if (!order) {
      Logger.error(
        `Order with id ${orderId} not found, ignoring this order...`,
        loggerCtx
      );
      return;
    }
    const hasPicqerHandler = order.shippingLines.some(
      (s) => s.shippingMethod?.fulfillmentHandlerCode === picqerHandler.code
    );
    if (!hasPicqerHandler) {
      Logger.info(
        `Order ${order.code} doesn't have the Picqer handler set in shipping lines, ignoring this order...`,
        loggerCtx
      );
      return;
    }
    // Push the order to Picqer
    await this.pushOrderToPicqer(ctx, order, client);
  }

  /**
   * Push the given order to Picqer
   */
  async pushOrderToPicqer(
    ctx: RequestContext,
    order: Order,
    picqerClient: PicqerClient
  ): Promise<void> {
    if (!order.customer) {
      throw Error(
        `Cannot push order '${order.code}' to picqer without an order.customer`
      );
    }
    let picqerCustomer: CustomerData | undefined = undefined;
    if (order.customer.user) {
      // This means customer is registered, not a guest
      const name =
        order.shippingAddress.company ??
        order.shippingAddress.fullName ??
        `${order.customer.firstName} ${order.customer.lastName}`;
      picqerCustomer = await picqerClient.getOrCreateMinimalCustomer(
        order.customer.emailAddress,
        name
      );
    }
    const vatGroups = await picqerClient.getVatGroups();
    // Create or update each product of order
    const productInputs: OrderProductInput[] = [];
    for (const line of order.lines) {
      const vatGroup = vatGroups.find(
        (vg) => vg.percentage === line.productVariant.taxRateApplied.value
      );
      if (!vatGroup) {
        throw Error(
          `Can not find vat group ${line.productVariant.taxRateApplied.value}% for variant ${line.productVariant.sku}. Can not create order in Picqer`
        );
      }
      const picqerProduct = await picqerClient.createOrUpdateProduct(
        line.productVariant.sku,
        this.mapToProductInput(ctx, line.productVariant, vatGroup.idvatgroup)
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const additionalOrderLineFields =
        this.options.pushPicqerOrderLineFields?.(ctx, line, order) || {};
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      productInputs.push({
        idproduct: picqerProduct.idproduct,
        amount: line.quantity,
        ...additionalOrderLineFields,
      });
    }
    let orderInput = this.mapToOrderInput(
      order,
      productInputs,
      picqerCustomer?.idcustomer
    );
    if (this.options.pushPicqerOrderFields) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const additionalFields = this.options.pushPicqerOrderFields(order);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      orderInput = {
        ...orderInput,
        ...additionalFields,
      };
      Logger.info(
        `Added custom order fields to order '${order.code}'`,
        loggerCtx
      );
    }
    const createdOrder = await picqerClient.createOrder(orderInput);
    await picqerClient.processOrder(createdOrder.idorder);
    Logger.info(
      `Created order "${order.code}" in status "processing" in Picqer with id ${createdOrder.idorder}`,
      loggerCtx
    );
  }

  /**
   * Find all variants by SKUS via raw connection for better performance
   * Only selects id and sku of variants
   */
  async findAllVariantsBySku(
    ctx: RequestContext,
    skus: string[]
  ): Promise<Pick<ProductVariant, 'id' | 'sku'>[]> {
    let skip = 0;
    const take = 1000;
    let hasMore = true;
    const allVariants: ProductVariant[] = [];
    while (hasMore) {
      const [variants, count] = await this.connection
        .getRepository(ctx, ProductVariant)
        .createQueryBuilder('variant')
        .select(['variant.id', 'variant.sku'])
        .leftJoin('variant.channels', 'channel')
        .where('channel.id = :channelId', { channelId: ctx.channelId })
        .andWhere('variant.sku IN(:...skus)', { skus })
        .andWhere('variant.deletedAt IS NULL')
        .skip(skip)
        .take(take)
        .getManyAndCount();
      allVariants.push(...variants);
      if (allVariants.length >= count) {
        hasMore = false;
      }
      skip += take;
    }
    return allVariants;
  }

  /**
   * Creates or updates products in Picqer based on the given variantIds.
   * Checks for existance of SKU in Picqer and updates if found.
   * If not found, creates a new product.
   */
  async handlePushVariantsJob(
    userCtx: RequestContext,
    variantIds: ID[]
  ): Promise<void> {
    const ctx = this.createDefaultLanguageContext(userCtx);
    const client = await this.getClient(ctx);
    if (!client) {
      return;
    }
    const variants = await this.variantService.findByIds(ctx, variantIds);
    const vatGroups = await client.getVatGroups();
    await Promise.all(
      variants.map(async (variant) => {
        const vatGroup = vatGroups.find(
          (vg) => vg.percentage === variant.taxRateApplied.value
        );
        if (!vatGroup) {
          Logger.error(
            `Could not find vatGroup for taxRate ${variant.taxRateApplied.value} for variant ${variant.sku}. Not pushing this variant to Picqer`,
            loggerCtx
          );
          return;
        }
        try {
          await this.entityHydrator.hydrate(ctx, variant, {
            relations: ['product'],
          });
          const productInput = this.mapToProductInput(
            ctx,
            variant,
            vatGroup.idvatgroup
          );
          const picqerProduct = await client.createOrUpdateProduct(
            variant.sku,
            productInput
          );
          // Update images
          const shouldUpdateImages = !picqerProduct.images?.length;
          if (!shouldUpdateImages) {
            return;
          }
          const featuredImage = await this.getFeaturedImageAsBase64(
            ctx,
            variant
          );
          if (featuredImage) {
            await client.addImage(picqerProduct.idproduct, featuredImage);
            Logger.info(
              `Added image for variant ${variant.sku} in Picqer for channel ${ctx.channel.token}`,
              loggerCtx
            );
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
          throw new Error(
            //eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            `Error pushing variant ${variant.sku} to Picqer: ${e?.message}`
          );
        }
      })
    );
  }

  /**
   * Create or update config for the current channel and register webhooks after saving.
   */
  async upsertConfig(
    ctx: RequestContext,
    input: PicqerConfigInput
  ): Promise<PicqerConfig> {
    const repository = this.connection.getRepository(ctx, PicqerConfigEntity);
    const existing = await repository.findOne({
      where: {
        channelId: String(ctx.channelId),
      },
    });
    if (existing) {
      (input as Partial<PicqerConfigEntity>).id = existing.id;
    }
    await repository.save({
      ...input,
      channelId: ctx.channelId,
    } as PicqerConfigEntity);
    Logger.info(
      `Picqer config updated for channel ${ctx.channel.token} by user ${ctx.activeUserId}`,
      loggerCtx
    );
    const config = await repository.findOneOrFail({
      where: {
        channelId: String(ctx.channelId),
      },
    });
    await this.registerWebhooks(ctx, config).catch((e) =>
      Logger.error(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Failed to register webhooks for channel ${ctx.channel.token}: ${e?.message}`,
        loggerCtx
      )
    );
    return config;
  }

  /**
   * Create a new RequestContext with the default language of the current channel.
   */
  createDefaultLanguageContext(ctx: RequestContext): RequestContext {
    return new RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      languageCode: ctx.channel.defaultLanguageCode,
      channel: ctx.channel,
    });
  }

  /**
   * Get a Picqer client for the current channel if the config is complete and enabled.
   */
  async getClient(
    ctx: RequestContext,
    config?: PicqerConfig
  ): Promise<PicqerClient | undefined> {
    if (!config) {
      config = (await this.getConfig(ctx)) ?? undefined;
    }
    if (!config || !config.enabled) {
      Logger.info(
        `Picqer is not enabled for channel ${ctx.channel.token}`,
        loggerCtx
      );
      return;
    }
    if (
      !config.apiKey ||
      !config.apiEndpoint ||
      !config.storefrontUrl ||
      !config.supportEmail
    ) {
      Logger.warn(
        `Picqer config is incomplete for channel ${ctx.channel.token}`,
        loggerCtx
      );
      return;
    }
    return new PicqerClient(config as PicqerClientInput); // Safe, because we checked for undefined values
  }

  /**
   * Get featured asset as base64 string, but only when the asset is a png or jpeg.
   * If variant has no featured asset, it checks if the parent product has a featured asset.
   */
  async getFeaturedImageAsBase64(
    ctx: RequestContext,
    variant: ProductVariant
  ): Promise<string | undefined> {
    let asset = await this.assetService.getFeaturedAsset(ctx, variant);
    if (!asset?.preview && this.options.fallBackToProductFeaturedAsset) {
      // No featured asset on variant, try the parent product
      await this.entityHydrator.hydrate(ctx, variant, {
        relations: ['product'],
      });
      asset = await this.assetService.getFeaturedAsset(ctx, variant.product);
    }
    if (!asset?.preview) {
      // Still no asset, return undefined
      return;
    }
    const image = asset.preview;
    const hasAllowedExtension = ['png', 'jpg', 'jpeg'].some((extension) =>
      image.endsWith(extension)
    );
    if (!hasAllowedExtension) {
      // Only png, jpg and jpeg are supported by Picqer
      Logger.info(
        `featured asset for variant ${variant.sku} is not a png or jpeg, skipping`,
        loggerCtx
      );
      return;
    }
    const buffer =
      await this.configService.assetOptions.assetStorageStrategy.readFileToBuffer(
        image
      );
    return buffer.toString('base64');
  }

  /**
   * Get the Picqer config for the current channel based on given context
   */
  async getConfig(ctx: RequestContext): Promise<PicqerConfig | null> {
    const repository = this.connection.getRepository(ctx, PicqerConfigEntity);
    return repository.findOne({ where: { channelId: String(ctx.channelId) } });
  }

  async getAllConfigs(): Promise<PicqerConfigEntity[]> {
    const repository =
      this.connection.rawConnection.getRepository(PicqerConfigEntity);
    return repository.find();
  }

  /**
   * Validate Picqer credentials by requesting `stats` from Picqer
   */
  async testRequest(input: TestPicqerInput): Promise<boolean> {
    const client = new PicqerClient(input);
    // If getStatus() doesn't throw, the request is valid
    try {
      await client.getStats();
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Creates admin context for channel
   */
  async getCtxForChannel(channelToken: string): Promise<RequestContext> {
    const channel = await this.channelService.getChannelFromToken(channelToken);
    return new RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      channel,
    });
  }

  mapToCustomerInput(customer: Customer, companyName?: string): CustomerInput {
    const customerName = `${customer.firstName} ${customer.lastName}`;
    return {
      name: companyName || customerName,
      contactname: customerName,
      emailaddress: customer.emailAddress,
      telephone: customer.phoneNumber,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      addresses: customer.addresses.map(this.mapToAddressInput),
    };
  }

  mapToAddressInput(address: Address): AddressInput {
    return {
      name: address.fullName,
      address: `${address.streetLine1} ${address.streetLine2 ?? ''}`.trim(),
      zipcode: address.postalCode,
      city: address.city,
      country: address.country?.code.toUpperCase(),
      defaultdelivery: address.defaultShippingAddress,
      defaultinvoice: address.defaultBillingAddress,
    };
  }

  mapToProductInput(
    ctx: RequestContext,
    variant: ProductVariant,
    vatGroupId: number
  ): ProductInput {
    const additionalFields =
      this.options.pushProductVariantFields?.(variant) || {};
    if (!variant.sku) {
      throw Error(`Variant with ID ${variant.id} has no SKU`);
    }
    let name: string =
      variant.translations?.find(
        (t) => t.languageCode === ctx.channel.defaultLanguageCode
      )?.name ??
      variant.name ??
      variant.translations?.[0]?.name;
    if (!name) {
      Logger.info(
        `Variant ${variant.sku} has no name, using SKU as name for Picqer product`,
        loggerCtx
      );
      name = variant.sku;
    }
    return {
      ...additionalFields,
      idvatgroup: vatGroupId,
      name,
      price: currency(variant.price / 100).value, // Convert to float with 2 decimals
      productcode: variant.sku,
      active: true,
    };
  }

  mapToOrderInput(
    order: Order,
    products: OrderProductInput[],
    customerId?: number
  ): OrderInput {
    if (!order.customer) {
      throw Error(
        `Cannot map order '${order.code}' to Picqer order without order.customer`
      );
    }
    const shippingAddress = order.shippingAddress;
    const billingAddress = order.billingAddress;
    const customerFullname = [order.customer.firstName, order.customer.lastName]
      .join(' ')
      .trim();
    const [deliveryname, deliverycontactname] =
      this.getAddressName(shippingAddress);
    const [invoicename, invoicecontactname] =
      this.getAddressName(billingAddress);
    return {
      idcustomer: customerId, // If none given, this creates a guest order
      reference: order.code,
      emailaddress: order.customer.emailAddress,
      telephone: order.customer.phoneNumber,
      deliveryname: deliveryname ?? customerFullname,
      deliverycontactname,
      deliveryaddress: this.getFullAddress(shippingAddress),
      deliveryzipcode: shippingAddress.postalCode,
      deliverycity: shippingAddress.city,
      deliverycountry: shippingAddress.countryCode?.toUpperCase(),
      // use billing if available, otherwise fallback to shipping address or email address
      invoicename:
        invoicename?.trim() ||
        deliveryname?.trim() ||
        customerFullname ||
        order.customer.emailAddress,
      invoicecontactname,
      invoiceaddress: this.getFullAddress(billingAddress),
      invoicezipcode: billingAddress?.postalCode,
      invoicecity: billingAddress?.city,
      invoicecountry: order.billingAddress?.countryCode?.toUpperCase(),
      products,
    };
  }

  /**
   * Combine street and housenumber to get a full readable address.
   * Returns undefined if address undefined
   */
  private getFullAddress(address?: OrderAddress): string | undefined {
    if (!address?.streetLine1 && !address?.streetLine2) {
      return undefined;
    }
    return [address.streetLine1 ?? '', address.streetLine2 ?? '']
      .join(' ')
      .trim();
  }

  /**
   * Get name and contactname for given address
   * returns [name, contactname]
   *
   * If a company is given, use the company as name and the full name as contact name
   * Otherwise, use the full name as name and no explicit contact name
   */
  private getAddressName(
    address?: Pick<OrderAddress, 'company' | 'fullName'>
  ): [string | undefined, string | undefined] {
    let name;
    let contactname;
    if (address?.company?.trim()) {
      name = address.company;
      contactname = address.fullName;
    } else {
      name = address?.fullName;
      contactname = undefined;
    }
    return [name, contactname];
  }
}
