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
  StockLevel,
  StockLevelService,
  TransactionalConnection,
  Translated,
  translateDeep,
  UserInputError,
} from '@vendure/core';
import { IsNull } from 'typeorm';
import util from 'util';
import { transitionToDelivered } from '../../../util/src';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { GoedgepicktClient } from './goedgepickt.client';
import { goedgepicktHandler } from './goedgepickt.handler';
import {
  Order as GgOrder,
  GoedgepicktEvent,
  GoedgepicktPluginConfig,
  OrderInput,
  OrderItemInput,
  ProductInput,
} from './goedgepickt.types';

interface StockInput {
  variantId: ID;
  /**
   * This should be the free stock level
   */
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

interface SyncOrderJobData {
  action: 'sync-order';
  ctx: SerializedRequestContext;
  orderCode: string;
}

type JobData =
  | PushProductJobData
  | PushProductByVariantsJobData
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

  /**
   * Register the required webhooks in GG
   */
  async registerWebhooks(ctx: RequestContext): Promise<undefined> {
    const client = this.getClientForChannel(ctx);
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
    if (!orderStatusWebhook) {
      const created = await client.createWebhook({
        webhookEvent: GoedgepicktEvent.orderStatusChanged,
        targetUrl: webhookTarget,
      });
      Logger.info(
        `Created OrderStatusWebhook '${created.webhookUuid}' because it didn't exist.`,
        loggerCtx
      );
    } else {
      Logger.info(`OrderStatusWebhook already present`, loggerCtx);
    }
    if (!stockWebhook) {
      const created = await client.createWebhook({
        webhookEvent: GoedgepicktEvent.stockChanged,
        targetUrl: webhookTarget,
      });
      Logger.info(
        `Created StockWebhook '${created.webhookUuid}' because it didn't exist.`,
        loggerCtx
      );
    } else {
      Logger.info(`StockWebhook already present`, loggerCtx);
    }
  }

  /**
   * Update stock in Vendure based on Goedgepickt webhook event
   */
  async handleIncomingStockUpdate(
    ctx: RequestContext,
    productSku: string
  ): Promise<void> {
    const client = this.getClientForChannel(ctx);
    if (!client) {
      return;
    }
    const ggProduct = await client.findProductBySku(productSku);
    if (!ggProduct) {
      Logger.warn(
        `Product with sku '${productSku}' doesn't exists in GoedGepickt. Ignoring incoming stock update event`,
        loggerCtx
      );
      return;
    }
    const ggStock = ggProduct.stock?.freeStock;
    if (ggStock === null || ggStock === undefined) {
      Logger.warn(
        `Product with sku '${productSku}' has no freeStock in GoedGepickt. Ignoring incoming stock update event`,
        loggerCtx
      );
      return;
    }
    const variants = await this.getVariants(ctx, productSku);
    const stockInput: StockInput[] = variants.map((v) => ({
      variantId: v.id as string,
      stock: ggStock,
    }));
    await this.updateStock(ctx, stockInput);
    Logger.info(
      `Updated stock for ${productSku} to ${ggStock} via incoming event`,
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
      const client = this.getClientForChannel(ctx);
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
        !order.shippingAddress.streetLine1
      ) {
        throw Error(
          `Missing required order fields streetLine1, streetLine2. Cannot push order to GoedGepickt`
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
      const orderStatus =
        (await this.config.determineOrderStatus?.(ctx, order)) || 'open';
      const orderInput: OrderInput = {
        orderId: order.code,
        orderDisplayId: order.code,
        createDate: GoedgepicktService.toLocalTime(
          order.orderPlacedAt || order.updatedAt
        )!,
        orderStatus,
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
      const customFields = order.customFields;
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
  async handleIncomingOrderStatusUpdate(
    ctx: RequestContext,
    orderCode: string,
    orderUuid: string
  ): Promise<void> {
    const client = this.getClientForChannel(ctx);
    if (!client) {
      return;
    }
    const ggOrder = await client.getOrder(orderUuid);
    if (!ggOrder) {
      Logger.warn(
        `Order with uuid '${orderUuid}' doesn't exists in GoedGepickt. Ignoring incoming order status update for order'${orderCode}'`,
        loggerCtx
      );
      return;
    }
    const newStatus = ggOrder.status;
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
          {
            name: 'trackingCode',
            value:
              ggOrder.shipments?.map((s) => s.trackTraceCode).join(',') ?? '',
          },
          {
            name: 'trackingUrls',
            value:
              ggOrder.shipments?.map((s) => s.trackTraceUrl).join(',') ?? '',
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
  getClientForChannel(ctx: RequestContext): GoedgepicktClient | undefined {
    if (!ctx.channel.customFields.ggEnabled) {
      Logger.info(
        `GoedGepickt plugin is disabled for channel ${ctx.channel.token}`
      );
      return undefined;
    }
    const [uuid, apiKey] = (ctx.channel.customFields.ggUuidApiKey || '').split(
      ':'
    );
    if (!uuid || !apiKey) {
      throw Error(
        `GoedGepickt plugin is enabled, but incomplete config found for channel ${ctx.channel.token}`
      );
    }
    return new GoedgepicktClient({
      webshopUuid: uuid,
      apiKey: apiKey,
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
    const client = this.getClientForChannel(ctx);
    if (!client) {
      throw new UserInputError(
        `GoedGepickt is not configured for channel ${channelToken}`
      );
    }
    const [ggProducts, variants] = await Promise.all([
      client.getAllProducts(),
      this.getVariants(ctx),
    ]);
    Logger.info(
      `Pushing ${variants.length} Vendure variants for channel ${channelToken} to GoedGepickt and fetching stock levels for those variants from GoedGepickt`,
      loggerCtx
    );
    // Update stock levels based on GG products
    const stockLevelInputs: StockInput[] = [];
    ggProducts.forEach((p) => {
      const variantId = variants.find((v) => v.sku === p.sku)?.id;
      if (!variantId) {
        Logger.info(
          `No variant found for product with sku ${p.sku}`,
          loggerCtx
        );
        return;
      }
      if (p.stock?.freeStock === undefined || p.stock?.freeStock === null) {
        Logger.error(
          `No stock found on product from GoedGepickt with sku ${p.sku}`,
          loggerCtx
        );
        return;
      }
      stockLevelInputs.push({
        variantId,
        stock: p.stock?.freeStock,
      });
    });
    // We can update stock in main thread, it's not that heavy currently
    await this.updateStock(ctx, stockLevelInputs);
    // Create product push jobs. 30 products per job
    const productInputs: ProductInput[] = [];
    for (const variant of variants) {
      const existing = ggProducts.find(
        (ggProduct) => ggProduct.sku === variant.sku
      );
      productInputs.push(this.mapToProductInput(variant, existing?.uuid));
    }
    const pushBatches = this.getBatches(productInputs, 15); // Batch of 15, so we stay under the 60 per minute limit in a single job
    await Promise.all(
      pushBatches.map(async (batch) => {
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
      })
    );
  }

  /**
   * Create or update product in Goedgepickt based on given productInput
   */
  async handlePushProductJob(
    ctx: RequestContext,
    { products }: PushProductJobData
  ): Promise<void> {
    const client = this.getClientForChannel(ctx);
    if (!client) {
      return;
    }
    for (const product of products) {
      if (product.uuid) {
        product.picture = undefined; // Don't update picture on existing product
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
    const client = this.getClientForChannel(ctx);
    if (!client) {
      return;
    }
    for (const variant of variants) {
      const existing = await client.findProductBySku(variant.sku);
      const product = this.mapToProductInput(
        this.setAbsoluteImage(ctx, variant)
      );
      const uuid = existing?.uuid;
      if (uuid) {
        product.picture = undefined; // Don't update picture on existing product
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
   * Update stock for variants based on given GG products
   */
  private async updateStock(
    ctx: RequestContext,
    stockInput: StockInput[]
  ): Promise<ProductVariant[]> {
    const variantsWithStock = stockInput.map((input) => ({
      id: input.variantId,
      stockOnHand: input.stock,
    }));
    const batches = this.getBatches(variantsWithStock, 500);
    const allVariants: ProductVariant[] = [];
    for (const batch of batches) {
      const variants = await this.variantService.update(ctx, batch);
      // Set allocated of each variant to 0
      const variantIds = batch.map((v) => v.id);
      if (!variantIds.length) {
        return [];
      }
      await this.connection
        .getRepository(ctx, StockLevel)
        .createQueryBuilder()
        .update()
        .set({ stockAllocated: 0 })
        .where('productVariantId IN (:...variantIds)', { variantIds })
        .execute();
      const skus = variants.map((v) => v.sku);
      Logger.info(
        `Updated stock of variants for channel ${
          ctx.channel.token
        }: ${skus.join(',')}`,
        loggerCtx
      );
      allVariants.push(...variants);
    }
    return allVariants;
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
        .map((v) => this.setAbsoluteImage(ctx, v));
      translatedVariants.push(...(await Promise.all(mappedVariants)));
    }
    return translatedVariants;
  }

  /**
   * Set the absolute image URL on a variant
   */
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
    const client = this.getClientForChannel(ctx);
    if (!client) {
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
        'payments',
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

  static toLocalTime(date: Date) {
    const tzoffset = date.getTimezoneOffset() * 60000; //offset in milliseconds
    return new Date(date.getTime() - tzoffset).toISOString().slice(0, -1);
  }
}
