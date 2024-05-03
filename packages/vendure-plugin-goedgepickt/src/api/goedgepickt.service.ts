import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import {
  ChannelService,
  ConfigService,
  EntityHydrator,
  EventBus,
  HistoryService,
  ID,
  JobQueue,
  JobQueueService,
  ListQueryBuilder,
  Logger,
  Order,
  OrderPlacedEvent,
  OrderService,
  ProductPriceApplicator,
  ProductVariant,
  ProductVariantEvent,
  ProductVariantService,
  RequestContext,
  SerializedRequestContext,
  StockLevelService,
  TransactionalConnection,
  Translated,
  translateDeep,
} from '@vendure/core';
import { IsNull } from 'typeorm';
import util from 'util';
import { transitionToDelivered } from '../../../util/src';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { PickupPointCustomFields } from './custom-fields';
import { GoedgepicktConfigEntity } from './goedgepickt-config.entity';
import { GoedgepicktClient } from './goedgepickt.client';
import { goedgepicktHandler } from './goedgepickt.handler';
import {
  GoedgepicktEvent,
  GoedgepicktPluginConfig,
  Order as GgOrder,
  OrderInput,
  OrderItemInput,
  OrderStatus,
  ProductInput,
} from './goedgepickt.types';

interface StockInput {
  variantId: string;
  stock: number;
}

type VariantWithImage = {
  id: ID;
  productId: ID;
  sku: string;
  name: string;
  price: number;
  absoluteImageUrl?: string;
};

interface PushProductJobData {
  action: 'push-product';
  ctx: SerializedRequestContext;
  products: ProductInput[];
}

interface PushProductByVariantsJobData {
  action: 'push-product-by-variants';
  ctx: SerializedRequestContext;
  variants: ProductVariant[];
}

interface UpdateStockJobData {
  action: 'update-stock';
  ctx: SerializedRequestContext;
  stock: StockInput[];
}

interface SyncOrderJobData {
  action: 'sync-order';
  ctx: SerializedRequestContext;
  orderCode: string;
}

type JobData =
  | PushProductJobData
  | PushProductByVariantsJobData
  | UpdateStockJobData
  | SyncOrderJobData;

@Injectable()
export class GoedgepicktService
  implements OnApplicationBootstrap, OnModuleInit
{
  readonly queryLimit: number;
  // @ts-ignore
  private jobQueue!: JobQueue<JobData>;

  constructor(
    private variantService: ProductVariantService,
    private channelService: ChannelService,
    @Inject(PLUGIN_INIT_OPTIONS) private config: GoedgepicktPluginConfig,
    private configService: ConfigService,
    private stockLevelService: StockLevelService,
    private connection: TransactionalConnection,
    private jobQueueService: JobQueueService,
    private orderService: OrderService,
    private entityHydrator: EntityHydrator,
    private listQueryBuilder: ListQueryBuilder,
    private eventBus: EventBus,
    private productPriceApplicator: ProductPriceApplicator,
    private historyService: HistoryService
  ) {
    this.queryLimit = configService.apiOptions.adminListQueryLimit;
  }

  async onModuleInit() {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'goedgepickt-sync',
      process: async ({ data, id }) => {
        try {
          const ctx = RequestContext.deserialize(data.ctx);
          if (data.action === 'sync-order') {
            await this.syncOrder(ctx, data.orderCode);
          } else if (data.action === 'push-product') {
            await this.handlePushProductJob(ctx, data);
          } else if (data.action === 'update-stock') {
            await this.handleStockUpdateJob(ctx, data.stock);
          } else if (data.action === 'push-product-by-variants') {
            await this.handlePushByVariantsJob(ctx, data);
          } else {
            return Logger.error(
              `Invalid jobqueue action '${JSON.stringify(data)}'`,
              loggerCtx
            );
          }
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes('Too Many Attempts')
          ) {
            Logger.info(
              `Failed to process job ${data.action} (${id}) for channel ${data.ctx._channel.token}: ${error}`,
              loggerCtx
            );
            throw error;
          }
          // Loggable job data without entire request context
          const loggableData = {
            ...data,

            ctx: undefined,
          };
          Logger.warn(
            `Failed to process job ${data.action} (${id}) for channel ${
              data.ctx._channel.token
            }: ${error}. Job data: ${util.inspect(loggableData, false, 5)}`,
            loggerCtx
          );
          throw error;
        }
      },
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async (event) => {
      await this.jobQueue.add(
        {
          action: 'sync-order',
          orderCode: event.order.code,
          ctx: event.ctx.serialize(),
        },
        { retries: 10 }
      );
    });
    // Listen for Variant changes
    this.eventBus
      .ofType(ProductVariantEvent)
      .subscribe(async ({ ctx, entity, type, input }) => {
        if (type !== 'created' && type !== 'updated') {
          // Only handle created and updated events
          return;
        }
        // Batch per 15 because of the Goedgepickt limit
        const batches = this.getBatches(entity, 15);
        for (const batch of batches) {
          await this.jobQueue.add(
            {
              action: 'push-product-by-variants',
              ctx: ctx.serialize(),
              variants: batch,
            },
            { retries: 20 }
          );
          Logger.info(
            `Added ${entity.length} to 'push-product-by-variants' queue, because they were ${type}`,
            loggerCtx
          );
        }
      });
  }

  async upsertConfig(
    ctx: RequestContext,
    config: Partial<GoedgepicktConfigEntity>
  ): Promise<GoedgepicktConfigEntity> {
    config.channelToken = ctx.channel.token;
    const existing = await this.connection
      .getRepository(ctx, GoedgepicktConfigEntity)
      .findOne({ where: { channelToken: config.channelToken } });
    if (existing) {
      await this.connection
        .getRepository(ctx, GoedgepicktConfigEntity)
        .update(existing.id, config);
    } else {
      await this.connection
        .getRepository(ctx, GoedgepicktConfigEntity)
        .insert(config);
    }
    return this.connection
      .getRepository(ctx, GoedgepicktConfigEntity)
      .findOneOrFail({ where: { channelToken: config.channelToken } });
  }

  async getConfig(
    ctx: RequestContext
  ): Promise<GoedgepicktConfigEntity | null> {
    return this.connection
      .getRepository(ctx, GoedgepicktConfigEntity)
      .findOne({ where: { channelToken: ctx.channel.token } });
  }

  async getConfigs(): Promise<GoedgepicktConfigEntity[]> {
    return this.connection.getRepository(GoedgepicktConfigEntity).find();
  }

  /**
   * Set webhook and update secrets in DB
   */
  async setWebhooks(ctx: RequestContext): Promise<undefined> {
    const client = await this.getClientForChannel(ctx);
    if (!client) {
      return;
    }
    const webhookTarget = this.getWebhookUrl(ctx.channel.token);
    // Check if webhooks already present
    const webhooks = await client.getWebhooks();
    const orderStatusWebhook = webhooks.find(
      (webhook) =>
        webhook.targetUrl === webhookTarget &&
        webhook.webhookEvent === GoedgepicktEvent.orderStatusChanged
    );
    const stockWebhook = webhooks.find(
      (webhook) =>
        webhook.targetUrl === webhookTarget &&
        webhook.webhookEvent === GoedgepicktEvent.stockChanged
    );
    let orderSecret = orderStatusWebhook?.webhookSecret;
    let stockSecret = stockWebhook?.webhookSecret;
    if (!orderSecret) {
      Logger.info(
        `Creating OrderStatusWebhook because it didn't exist.`,
        loggerCtx
      );
      const created = await client.createWebhook({
        webhookEvent: GoedgepicktEvent.orderStatusChanged,
        targetUrl: webhookTarget,
      });
      orderSecret = created.webhookSecret;
    } else {
      Logger.info(`OrderStatusWebhook already present`, loggerCtx);
    }
    if (!stockSecret) {
      Logger.info(`Creating stockWebhook because it didn't exist.`, loggerCtx);
      const created = await client.createWebhook({
        webhookEvent: GoedgepicktEvent.stockChanged,
        targetUrl: webhookTarget,
      });
      stockSecret = created.webhookSecret;
    } else {
      Logger.info(`StockWebhook already present`, loggerCtx);
    }
    await this.upsertConfig(ctx, {
      orderWebhookKey: orderSecret,
      stockWebhookKey: stockSecret,
    });
  }

  /**
   * Update stock in Vendure based on Goedgepickt webhook event
   */
  async processStockUpdateEvent(
    ctx: RequestContext,
    productSku: string,
    ggStock: number
  ): Promise<void> {
    const variants = await this.getVariants(ctx, productSku);
    await this.createStockUpdateJobs(
      ctx,
      [{ sku: productSku, stockLevel: ggStock }],
      variants
    );
    Logger.info(
      `Created stock update job for ${productSku} to ${ggStock} via incoming event`,
      loggerCtx
    );
  }

  /**
   * Create order in GoedGepickt
   * Needs an order including lines, items and variants
   */
  private async createOrder(
    ctx: RequestContext,
    order: Order
  ): Promise<GgOrder | undefined> {
    try {
      const client = await this.getClientForChannel(ctx);
      if (!client) {
        return undefined;
      }
      const orderItems: OrderItemInput[] = order.lines.map((orderLine) => ({
        sku: orderLine.productVariant.sku,
        productName: orderLine.productVariant.name,
        productQuantity: orderLine.quantity,
        taxRate: orderLine.taxRate,
      }));
      if (
        !order.shippingAddress.streetLine2 ||
        !order.shippingAddress.streetLine1 ||
        !order.orderPlacedAt
      ) {
        throw Error(
          `Missing required order fields streetLine1, streetLine2 or order.orderPlacedAt. Cannot push order to GoedGepickt`
        );
      }
      const { houseNumber, addition } =
        GoedgepicktService.splitHouseNumberAndAddition(
          order.shippingAddress.streetLine2
        );
      const billingAddress =
        order.billingAddress && order.billingAddress.streetLine1
          ? order.billingAddress
          : order.shippingAddress;
      const { houseNumber: billingHouseNumber, addition: billingAddition } =
        GoedgepicktService.splitHouseNumberAndAddition(
          order.shippingAddress.streetLine2
        );
      const orderInput: OrderInput = {
        orderId: order.code,
        orderDisplayId: order.code,
        createDate: GoedgepicktService.toLocalTime(order.orderPlacedAt)!,
        orderStatus: 'open',
        orderItems,
        shippingFirstName: order.customer?.firstName,
        shippingLastName: order.customer?.lastName,
        shippingCompany: order.shippingAddress.company,
        shippingAddress: order.shippingAddress.streetLine1,
        shippingHouseNumber: houseNumber,
        shippingHouseNumberAddition: addition,
        shippingZipcode: order.shippingAddress.postalCode,
        shippingCity: order.shippingAddress.city,
        shippingCountry: order.shippingAddress.countryCode?.toUpperCase(),
        billingFirstName: order.customer?.firstName,
        billingLastName: order.customer?.lastName,
        billingCompany: billingAddress.company,
        billingHouseNumber: billingHouseNumber,
        billingHouseNumberAddition: billingAddition,
        billingZipcode: billingAddress.postalCode,
        billingCity: billingAddress.city,
        billingCountry: billingAddress.countryCode?.toUpperCase(),
        billingEmail: order.customer?.emailAddress,
        billingPhone: order.customer?.phoneNumber,
        paymentMethod: order.payments?.[0]?.method,
        ignoreUnknownProductWarnings: true,
        customerNote: (order.customFields as any)?.customerNote,
        shippingMethod: order.shippingLines
          .map((line) => line.shippingMethod?.name)
          .join(','),
      };
      const customFields = order.customFields as
        | PickupPointCustomFields
        | undefined;
      if (
        customFields?.pickupLocationNumber ||
        customFields?.pickupLocationName
      ) {
        orderInput.pickupLocationData = {
          locationNumber: customFields.pickupLocationNumber,
          location: customFields.pickupLocationName,
          carrier: customFields.pickupLocationCarrier,
          street: customFields.pickupLocationStreet,
          houseNumber: customFields.pickupLocationHouseNumber,
          zipcode: customFields.pickupLocationZipcode,
          city: customFields.pickupLocationCity,
          country: customFields.pickupLocationCountry?.toUpperCase(),
        };
      }
      const ggOrder = await client.createOrder(orderInput);
      await this.logHistoryEntry(ctx, order.id);
      return ggOrder;
    } catch (error: unknown) {
      await this.logHistoryEntry(ctx, order.id, error);
      throw error;
    }
  }

  /**
   * Update order status in Vendure based on event
   */
  async updateOrderStatus(
    ctx: RequestContext,
    orderCode: string,
    orderUuid: string,
    newStatus: OrderStatus
  ): Promise<void> {
    let order = await this.orderService.findOneByCode(ctx, orderCode);
    if (!order) {
      Logger.warn(
        `Order with code ${orderCode} doesn't exists. Not updating status to ${newStatus} for this order in channel ${ctx.channel.token}`,
        loggerCtx
      );
      return;
    }
    if (newStatus === 'completed') {
      if (order.state === 'Delivered') {
        return;
      }
      await transitionToDelivered(this.orderService, ctx, order, {
        code: goedgepicktHandler.code,
        arguments: [
          {
            name: 'goedGepicktOrderUUID',
            value: orderUuid,
          },
        ],
      });
      Logger.info(`Updated order ${orderCode} to Delivered`, loggerCtx);
    } else {
      return Logger.info(
        `No status updates needed for order ${orderCode} for status ${newStatus}`,
        loggerCtx
      );
    }
  }

  /**
   * Returns undefined if plugin is disabled
   */
  async getClientForChannel(
    ctx: RequestContext
  ): Promise<GoedgepicktClient | undefined> {
    const config = await this.getConfig(ctx);
    if (!config?.enabled) {
      return undefined;
    }
    if (!config?.apiKey || !config.webshopUuid) {
      throw Error(
        `GoedGepickt plugin is enabled, but incomplete config found for channel ${ctx.channel.token}`
      );
    }
    return new GoedgepicktClient({
      webshopUuid: config.webshopUuid,
      apiKey: config.apiKey,
      orderWebhookKey: config.orderWebhookKey,
      stockWebhookKey: config.stockWebhookKey,
    });
  }

  getWebhookUrl(channelToken: string): string {
    let webhookTarget = this.config.vendureHost;
    if (!webhookTarget.endsWith('/')) {
      webhookTarget += '/';
    }
    return `${webhookTarget}goedgepickt/webhook/${channelToken}`;
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

  /**
   * Creates 2 types of jobs: jobs for pushing products and jobs for updating stocklevels
   */
  async createFullsyncJobs(channelToken: string): Promise<void> {
    const ctx = await this.getCtxForChannel(channelToken);
    const client = await this.getClientForChannel(ctx);
    if (!client) {
      return;
    }
    const [ggProducts, variants] = await Promise.all([
      client.getAllProducts(),
      this.getVariants(ctx),
    ]);
    Logger.info(
      `Pushing ${variants.length} Vendure variants for channel ${channelToken} to GoedGepickt and fetching stock levels for those variants from GoedGepickt`,
      loggerCtx
    );
    // Create update stocklevel jobs
    const stockLevelInputs = ggProducts.map((p) => ({
      sku: p.sku,
      stockLevel: p.stock?.freeStock,
    }));
    await this.createStockUpdateJobs(ctx, stockLevelInputs, variants);
    Logger.info(
      `Created stock update jobs for ${stockLevelInputs.length} Vendure variants via fullsync`,
      loggerCtx
    );
    // Create product push jobs. 30 products per job
    const productInputs: ProductInput[] = [];
    for (const variant of variants) {
      const existing = ggProducts.find(
        (ggProduct) => ggProduct.sku === variant.sku
      );
      productInputs.push(this.mapToProductInput(variant, existing?.uuid));
    }
    const pushBatches = this.getBatches(productInputs, 15); // Batch of 15, so we stay under the 60 per minute limit in a single job
    for (const batch of pushBatches) {
      await this.jobQueue.add(
        {
          action: 'push-product',
          ctx: ctx.serialize(),
          products: batch,
        },
        { retries: 20 }
      );
      Logger.info(
        `Created PushProducts job for ${batch.length} variants for channel ${channelToken}`,
        loggerCtx
      );
    }
  }

  /**
   * Create or update product in Goedgepickt based on given productInput
   */
  async handlePushProductJob(
    ctx: RequestContext,
    { products }: PushProductJobData
  ): Promise<void> {
    const client = await this.getClientForChannel(ctx);
    if (!client) {
      return;
    }
    for (const product of products) {
      if (product.uuid) {
        await client.updateProduct(product.uuid, product);
        Logger.debug(`Updated variant ${product.sku}`, loggerCtx);
      } else {
        await client.createProduct(product).catch((e) => {
          if (
            typeof e?.message === 'string' &&
            e.message.indexOf('already exists') > -1
          ) {
            // Ignore, this has already been created in previous try of this batch
          } else {
            throw e;
          }
        });
        Logger.debug(`Created variant ${product.sku}`, loggerCtx);
      }
    }
    Logger.info(
      `Pushed ${products.length} products to GoedGepickt for channel ${ctx.channel.token}`,
      loggerCtx
    );
  }

  /**
   * Create or update products in Goedgepickt based on given Vendure variants
   * Waits for 1 minute every 30 products, because of Goedgepickt's rate limit
   */
  async handlePushByVariantsJob(
    ctx: RequestContext,
    { variants }: PushProductByVariantsJobData
  ): Promise<void> {
    const client = await this.getClientForChannel(ctx);
    if (!client) {
      return;
    }
    for (const variant of variants) {
      const existing = await client.findProductBySku(variant.sku);
      const product = this.mapToProductInput(
        await this.setAbsoluteImage(ctx, variant)
      );
      const uuid = existing?.[0]?.uuid;
      if (uuid) {
        await client.updateProduct(uuid, product);
        Logger.debug(`Updated variant ${product.sku}`, loggerCtx);
      } else {
        await client.createProduct(product);
        Logger.debug(`Created variant ${product.sku}`, loggerCtx);
      }
    }
    Logger.info(
      `Pushed ${variants.length} variants to GoedGepickt for channel ${ctx.channel.token}`
    );
  }

  async logHistoryEntry(
    ctx: RequestContext,
    orderId: ID,
    error?: unknown
  ): Promise<void> {
    let prettifiedError = error
      ? JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)))
      : undefined; // Make sure its serializable
    await this.historyService.createHistoryEntryForOrder(
      {
        ctx,
        orderId,
        type: 'GOEDGEPICKT_NOTIFICATION' as any,
        data: {
          name: 'GoedGepickt',
          valid: !error,
          error: prettifiedError,
        },
      },
      false
    );
  }

  /**
   * Create batched jobs for updating variant stock
   */
  private async createStockUpdateJobs(
    ctx: RequestContext,
    ggProducts: { sku: string; stockLevel: number | undefined | null }[],
    variants: Pick<ProductVariant, 'id' | 'sku'>[]
  ) {
    const stockPerVariant: StockInput[] = [];
    for (const ggProduct of ggProducts) {
      const ggStock = ggProduct.stockLevel;
      if (ggStock === undefined || ggStock === null) {
        continue; // Not updating if no stock from GG
      }
      const variant = variants.find((v) => v.sku === ggProduct.sku);
      if (!variant) {
        continue; // Not updating if we have no variant with SKU
      }
      // If ggStock=0 and allocated=1, set Vendure stock=1 to prevent out of stock errors during fulfillment
      const availableStock = await this.stockLevelService.getAvailableStock(
        ctx,
        variant.id
      );
      let newStock = ggStock + availableStock.stockAllocated;
      if (newStock < 0) {
        // Prevent negative stock
        newStock = 0;
      }
      stockPerVariant.push({
        variantId: variant.id as string,
        stock: newStock,
      });
    }
    // Create jobs per 100 variants
    const stockBatches = this.getBatches(stockPerVariant, 100);
    for (const batch of stockBatches) {
      await this.jobQueue.add(
        {
          action: 'update-stock',
          stock: batch,
          ctx: ctx.serialize(),
        },
        { retries: 10 }
      );
      Logger.info(
        `Created stocklevel update job for ${batch.length} variants`,
        loggerCtx
      );
    }
  }

  private async handleStockUpdateJob(
    ctx: RequestContext,
    stockInput: StockInput[]
  ): Promise<ProductVariant[]> {
    const variantsWithStock = stockInput.map((input) => ({
      id: input.variantId,
      stockOnHand: input.stock,
    }));
    const variants = await this.variantService.update(ctx, variantsWithStock);
    const skus = variants.map((v) => v.sku);
    Logger.info(
      `Updated stock of variants for channel ${ctx.channel.token}: ${skus.join(
        ','
      )}`,
      loggerCtx
    );
    return variants;
  }

  private async getVariants(
    ctx: RequestContext,
    sku?: string
  ): Promise<VariantWithImage[]> {
    const translatedVariants: VariantWithImage[] = [];
    const take = 100;
    let skip = 0;
    let hasMore = true;
    while (hasMore) {
      const query = this.listQueryBuilder.build(
        ProductVariant,
        {
          skip,
          take,
        },
        {
          relations: [
            'featuredAsset',
            'channels',
            'product',
            'product.featuredAsset',
            'taxCategory',
          ],
          channelId: ctx.channelId,
          where: { deletedAt: IsNull() },
          ctx,
        }
      );
      if (sku) {
        query.andWhere('sku = :sku', { sku });
      }
      const variants = await query.getMany();
      hasMore = !!variants.length;
      skip += take;
      const variantsWithPrice = await Promise.all(
        variants.map((v) =>
          this.productPriceApplicator.applyChannelPriceAndTax(v, ctx)
        )
      );
      const mappedVariants = variantsWithPrice
        .map((v) => translateDeep(v, ctx.languageCode))
        .map(async (v) => await this.setAbsoluteImage(ctx, v));
      translatedVariants.push(...(await Promise.all(mappedVariants)));
    }
    return translatedVariants;
  }

  private setAbsoluteImage(
    ctx: RequestContext,
    variant: Translated<ProductVariant> | ProductVariant
  ): VariantWithImage {
    // Resolve images as if we are shop client
    const shopCtx = new RequestContext({
      apiType: 'shop',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      channel: ctx.channel,
    });
    let imageUrl =
      variant.featuredAsset?.preview || variant.product?.featuredAsset?.preview;
    if (
      this.configService.assetOptions.assetStorageStrategy.toAbsoluteUrl &&
      imageUrl
    ) {
      imageUrl = this.configService.assetOptions.assetStorageStrategy
        .toAbsoluteUrl!(shopCtx.req as any, imageUrl);
    }
    return {
      id: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      name: variant.name,
      price: variant.price,
      absoluteImageUrl: imageUrl,
    };
  }

  /**
   * Sync order to Goedgepickt platform
   */
  async syncOrder(ctx: RequestContext, orderCode: string): Promise<void> {
    const config = await this.getConfig(ctx);
    if (!config?.enabled) {
      return;
    }
    Logger.info(
      `Syncing order ${orderCode} for channel ${ctx.channel.token} to GoedGepickt`,
      loggerCtx
    );
    let order = await this.orderService.findOneByCode(ctx, orderCode);
    if (!order) {
      Logger.error(
        `No order found with code ${orderCode}. Can not sync this order.`,
        loggerCtx
      );
      return;
    }
    order = await this.entityHydrator.hydrate(ctx, order, {
      relations: [
        'shippingLines',
        'shippingLines.shippingMethod',
        'lines.productVariant',
      ],
    });
    const hasGoedgepicktHandler = order.shippingLines.some(
      (shippingLine) =>
        shippingLine.shippingMethod?.fulfillmentHandlerCode ===
        goedgepicktHandler.code
    );
    if (!hasGoedgepicktHandler) {
      Logger.info(
        `Order ${order.code} does not have Goedgepickt set as handler. Not syncing this order.`,
        loggerCtx
      );
      return;
    }
    await this.createOrder(ctx, order);
    Logger.info(
      `Order ${order.code} for channel ${ctx.channel.token} synced to GoedGepickt`,
      loggerCtx
    );
  }

  private mapToProductInput(
    variant: VariantWithImage,
    uuid?: string
  ): ProductInput {
    return {
      uuid,
      name: variant.name,
      sku: variant.sku,
      productId: variant.sku,
      stockManagement: true,
      url: `${this.config.vendureHost}/admin/catalog/products/${variant.productId};id=${variant.productId};tab=variants`,
      picture: variant.absoluteImageUrl,
      price: (variant.price / 100).toFixed(2),
    };
  }

  private getBatches<T>(array: T[], batchSize: number): T[][] {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  static splitHouseNumberAndAddition(houseNumberString: string): {
    houseNumber: number;
    addition?: string;
  } {
    const [houseNumber, ...addition] = houseNumberString.match(
      /[a-z]+|\d+/gi
    ) as any[];
    return {
      houseNumber,
      addition: addition.join() || undefined, // .join() can result in empty string
    };
  }

  static toLocalTime(date?: Date) {
    if (!date) {
      return undefined;
    }
    const tzoffset = date.getTimezoneOffset() * 60000; //offset in milliseconds
    return new Date(date.getTime() - tzoffset).toISOString().slice(0, -1);
  }
}
