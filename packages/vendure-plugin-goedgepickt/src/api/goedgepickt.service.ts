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
  OrderStateTransitionError,
  ProductPriceApplicator,
  ProductVariant,
  ProductVariantEvent,
  ProductVariantService,
  RequestContext,
  SerializedRequestContext,
  StockLevel,
  TransactionalConnection,
  Translated,
  translateDeep,
  UserInputError,
} from '@vendure/core';
import { IsNull } from 'typeorm';
import util from 'util';
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
import {
  CreateProductVariantInput,
  UpdateProductVariantInput,
} from '@vendure/common/lib/generated-types';
import { Request as ExpressRequest } from 'express';
import { asError } from 'catch-unknown';

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

/**
 * Job for pushing products to Goedgepickt
 */
interface PushProductsJobData {
  action: 'push-products';
  ctx: SerializedRequestContext;
  skus: string[];
}

interface SyncOrderJobData {
  action: 'sync-order';
  ctx: SerializedRequestContext;
  orderCode: string;
}
/**
 * Job that handles incoming stock updates from GoedGepickt webhooks
 */
interface StockUpdateWebhookJobData {
  action: 'incoming-stock-webhook';
  ctx: SerializedRequestContext;
  sku: string;
}

/**
 * Job that handles incoming order status updates from GoedGepickt webhooks
 */
interface OrderStatusWebhookJobData {
  action: 'incoming-order-status-webhook';
  ctx: SerializedRequestContext;
  orderCode: string;
  orderUuid: string;
}

type JobData =
  | PushProductsJobData
  | SyncOrderJobData
  | StockUpdateWebhookJobData
  | OrderStatusWebhookJobData;

@Injectable()
export class GoedgepicktService
  implements OnApplicationBootstrap, OnModuleInit
{
  readonly queryLimit: number;
  //@ts-ignore -- For some reason nested props are not allowed in job data, while they are stringifyable
  jobQueue!: JobQueue<JobData>;

  constructor(
    private variantService: ProductVariantService,
    private channelService: ChannelService,
    @Inject(PLUGIN_INIT_OPTIONS) private config: GoedgepicktPluginConfig,
    private configService: ConfigService,
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
            await this.pushOrderToGoedGepickt(ctx, data.orderCode);
          } else if (data.action === 'push-products') {
            await this.pushSkusToGoedGepickt(ctx, data);
          } else if (data.action === 'incoming-order-status-webhook') {
            await this.updateVendureOrderStatus(
              ctx,
              data.orderCode,
              data.orderUuid
            );
          } else if (data.action === 'incoming-stock-webhook') {
            await this.handleStockUpdateJob(ctx, data.sku);
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
      .subscribe(({ ctx, entity, type, input }) => {
        try {
          if (type !== 'created' && type !== 'updated') {
            // Only handle created and updated events
            return;
          }
          const updatedOrCreatedInput = input as
            | CreateProductVariantInput[]
            | UpdateProductVariantInput[];

          const isContentUpdated = updatedOrCreatedInput?.some(
            (i) => i.customFields || i.translations || i.price || i.sku
          );
          if (!isContentUpdated) {
            // Only push products on content updates like custom fields, names, slugs
            return;
          }
          const skus = entity.map((v) => v.sku);
          this.createPushProductJobs(ctx, skus);
        } catch (e) {
          const error = asError(e);
          Logger.error(
            `Error handling ProductVariantEvent`,
            loggerCtx,
            error.stack
          );
        }
      });
  }

  /**
   * Create jobs for pushing products to GoedGepickt
   * Creates jobs in batches of 15, because of the GoedGepickt rate limit
   *
   * Catches and logs errors instead of throwing them, because this is called from the event bus.
   */
  createPushProductJobs(ctx: RequestContext, skus: string[]): void {
    // Batch per 15 because of the GoedGepickt rate limit
    const batches = this.getBatches(skus, 15);
    for (const batch of batches) {
      this.jobQueue
        .add(
          {
            action: 'push-products',
            ctx: ctx.serialize(),
            skus: batch,
          },
          { retries: 20 }
        )
        .catch((err) => {
          Logger.error(
            `Failed to create 'push-products' jobs: ${err}`,
            loggerCtx
          );
        });
      Logger.info(
        `Created 'push-products' job for ${skus.length} variants for channel ${ctx.channel.token}`,
        loggerCtx
      );
    }
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
   * Update stock in Vendure based on Goedgepickt webhook data
   */
  async handleStockUpdateJob(
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
    if (!variants.length) {
      Logger.warn(
        `No variants found for product with sku '${productSku}' for channel '${ctx.channel.token}' in Vendure. Ignoring incoming stock update event...`,
        loggerCtx
      );
      return;
    }
    const stockInput: StockInput[] = variants.map((v) => ({
      variantId: v.id as string,
      stock: ggStock,
    }));
    await this.updateVendureStock(ctx, stockInput);
    Logger.info(
      `Updated stock for ${productSku} to ${ggStock} via incoming webhook`,
      loggerCtx
    );
  }

  /**
   * Update order status in Vendure based on the status from Goedgepickt
   */
  async updateVendureOrderStatus(
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
    const vendureOrder = await this.orderService.findOneByCode(ctx, orderCode);
    if (!vendureOrder) {
      Logger.warn(
        `Order with code ${orderCode} doesn't exists. Not updating status to ${newStatus} for this order in channel ${ctx.channel.token}`,
        loggerCtx
      );
      return;
    }
    if (newStatus !== 'completed') {
      return Logger.info(
        `No status updates needed for order ${orderCode} for status ${newStatus}`,
        loggerCtx
      );
    }
    if (vendureOrder.state === 'Delivered') {
      return;
    }
    if (vendureOrder.state === 'PaymentAuthorized') {
      // Dont try to transition to Delivered, because the payment still needs to be settled.
      // This can have multiple causes, like offline payments that need to be manually settled.
      Logger.info(
        `Order ${orderCode} is in PaymentAuthorized state. Not updating status to Delivered, because it's payment still needs to be settled.`,
        loggerCtx
      );
      return;
    }
    if (vendureOrder.state !== 'Shipped') {
      // Try to transition to shipped first
      await this.transitionToState(ctx, vendureOrder, 'Shipped');
      Logger.info(`Updated order ${orderCode} to Shipped`, loggerCtx);
    }
    await this.transitionToState(ctx, vendureOrder, 'Delivered');
    Logger.info(`Updated order ${orderCode} to Delivered`, loggerCtx);
  }

  /**
   * Returns undefined if plugin is disabled
   */
  getClientForChannel(ctx: RequestContext): GoedgepicktClient | undefined {
    if (!ctx.channel.customFields.ggEnabled) {
      Logger.info(
        `GoedGepickt plugin is disabled for channel ${ctx.channel.token}`,
        loggerCtx
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
   * 1. Gets all products from GG
   * 2. Updates stock in Vendure based on GG products
   * 3. Creates jobs for pushing products to GG
   */
  async doFullSync(channelToken: string): Promise<void> {
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
      `Full sync: Pushing ${variants.length} Vendure variants for channel ${channelToken} to GoedGepickt and fetching stock levels for those variants from GoedGepickt`,
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
    // Update stock in batches of 100
    const stockLevelBatches = this.getBatches(stockLevelInputs, 100);
    for (const batch of stockLevelBatches) {
      await this.updateVendureStock(ctx, batch);
    }
    // Create 'push-products' jobs
    const skus = variants.map((v) => v.sku);
    this.createPushProductJobs(ctx, skus);
  }

  /**
   * Create or update products in Goedgepickt based on given Vendure variants
   *
   * We assume here that jobs are already created in batches,
   * so all given skus will be processes at once
   */
  async pushSkusToGoedGepickt(
    ctx: RequestContext,
    { skus: variantSkus }: PushProductsJobData
  ): Promise<void> {
    const client = this.getClientForChannel(ctx);
    if (!client) {
      return;
    }
    for (const sku of variantSkus) {
      const variants = await this.getVariants(ctx, sku);
      const variant = variants?.[0];
      if (!variant) {
        Logger.info(
          `No variants found for sku ${sku} in channel ${ctx.channel.token}. Not pushing to GoedGepickt`,
          loggerCtx
        );
        continue;
      }
      const ggProductInput = this.mapToProductInput(variant);
      const existing = await client.findProductBySku(sku);
      const uuid = existing?.uuid;
      if (!existing?.picture?.toLowerCase().includes('image_placeholder.png')) {
        // The picture on GG is not a placeholder, so don't update it again.
        ggProductInput.picture = undefined; // Don't update picture on existing product
      }
      if (uuid) {
        await client.updateProduct(uuid, ggProductInput);
        Logger.debug(`Updated variant ${sku} in GoedGepickt`, loggerCtx);
      } else {
        await client.createProduct(ggProductInput);
        Logger.debug(`Created variant ${sku} in GoedGepickt`, loggerCtx);
      }
    }
    Logger.info(
      `Created/updated ${variantSkus.length} variants to GoedGepickt for channel ${ctx.channel.token}`
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
   * Update stock for variants in Vendure based on given GG products
   */
  private async updateVendureStock(
    ctx: RequestContext,
    stockInput: StockInput[]
  ): Promise<ProductVariant[]> {
    const variantsWithStock = stockInput.map((input) => ({
      id: input.variantId,
      stockOnHand: input.stock,
    }));
    const variants = await this.variantService.update(ctx, variantsWithStock);
    // Set allocated of each variant to 0
    const variantIds = variantsWithStock.map((v) => v.id);
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
      `Updated stock of variants for channel ${ctx.channel.token}: ${skus.join(
        ','
      )}`,
      loggerCtx
    );
    return variants;
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
      if (!houseNumber) {
        throw Error(
          `Order ${order.code} has no house number in streetLine2. Cannot push order to GoedGepickt`
        );
      }
      const billingAddress =
        order.billingAddress && order.billingAddress.streetLine1
          ? order.billingAddress
          : order.shippingAddress;
      const { houseNumber: billingHouseNumber, addition: billingAddition } =
        GoedgepicktService.splitHouseNumberAndAddition(
          billingAddress.streetLine2 ?? ''
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
        shippingHouseNumber: houseNumber ?? 0,
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
   * Transition an order to the given state, and throw an error if it fails, instead of returing the transition result.
   */
  private async transitionToState(
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
      const message = `Failed to transition order ${order.code} to ${state}: ${errorResult.message} - ${errorResult.transitionError}`;
      Logger.error(message, loggerCtx, util.inspect(errorResult));
      throw new Error(message);
    }
  }

  /**
   * Get all variants, or variants by SKU.
   * Returns translated variants, including an absolute Image Url
   */
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
        // Normalize the sku parameter so numeric IDs stay numbers,
        // but non‐numeric SKUs remain strings.
        // We've had some problems where numeric SKUs were not found
        const skuParam = /^\d+$/.test(sku) ? parseInt(sku, 10) : sku;
        query.andWhere('sku = :sku', { sku: skuParam });
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
    let imageUrl =
      variant.featuredAsset?.preview || variant.product?.featuredAsset?.preview;
    if (
      this.configService.assetOptions.assetStorageStrategy.toAbsoluteUrl &&
      imageUrl
    ) {
      // Needed for assetStorageStrategy toAbsoluteUrl
      const mockReq = {
        protocol: 'https',
        get: () => undefined,
        headers: {},
      } as unknown as ExpressRequest;
      imageUrl =
        this.configService.assetOptions.assetStorageStrategy.toAbsoluteUrl(
          ctx.req || mockReq,
          imageUrl
        );
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
  async pushOrderToGoedGepickt(
    ctx: RequestContext,
    orderCode: string
  ): Promise<void> {
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

  /**
   * Map a variant to a product input for GoedGepickt
   */
  private mapToProductInput(variant: VariantWithImage): ProductInput {
    return {
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
    houseNumber?: number;
    addition?: string;
  } {
    const result = houseNumberString.match(/[a-z]+|\d+/gi);
    if (!result) {
      return {
        houseNumber: undefined,
        addition: undefined,
      };
    }
    const [houseNumber, ...addition] = result;
    return {
      houseNumber: parseInt(houseNumber),
      addition: addition.join() || undefined, // .join() can result in empty string
    };
  }

  static toLocalTime(date: Date) {
    const tzoffset = date.getTimezoneOffset() * 60000; //offset in milliseconds
    return new Date(date.getTime() - tzoffset).toISOString().slice(0, -1);
  }
}
