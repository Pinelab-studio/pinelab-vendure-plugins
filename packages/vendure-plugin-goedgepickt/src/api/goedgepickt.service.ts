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
  JobQueue,
  JobQueueService,
  Logger,
  Order,
  OrderItem,
  OrderPlacedEvent,
  OrderService,
  ProductVariant,
  ProductVariantService,
  RequestContext,
  TransactionalConnection,
  Translated,
} from '@vendure/core';
import { GoedgepicktClient } from './goedgepickt.client';
import {
  GoedgepicktEvent,
  GoedgepicktPluginConfig,
  Order as GgOrder,
  OrderItemInput,
  OrderStatus,
  ProductInput,
} from './goedgepickt.types';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { GoedgepicktConfigEntity } from './goedgepickt-config.entity';
import { transitionToDelivered } from '../../../util/src';
import { goedgepicktHandler } from './goedgepickt.handler';

interface StockInput {
  variantId: string;
  stock: number;
}

type VariantWithImage = Translated<ProductVariant> & {
  absoluteImageUrl?: string;
};

@Injectable()
export class GoedgepicktService
  implements OnApplicationBootstrap, OnModuleInit
{
  readonly queryLimit: number;
  private jobQueue: JobQueue<{ channelToken: string }> | undefined;

  constructor(
    private variantService: ProductVariantService,
    private channelService: ChannelService,
    @Inject(PLUGIN_INIT_OPTIONS) private config: GoedgepicktPluginConfig,
    private configService: ConfigService,
    private connection: TransactionalConnection,
    private jobQueueService: JobQueueService,
    private orderService: OrderService,
    private entityHydrator: EntityHydrator,
    private eventBus: EventBus
  ) {
    this.queryLimit = configService.apiOptions.adminListQueryLimit;
  }

  async onModuleInit() {
    // Start JobQueue
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'pull-goedgepickt-stocklevels',
      process: async (job) =>
        await this.pullStocklevels(job.data.channelToken).catch((error) => {
          Logger.error(
            `Failed to pull stocklevels for ${job.data.channelToken}: ${error.message}`,
            loggerCtx,
            error
          );
        }),
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    // Push sync jobs to the worker queue
    const configs = (await this.getConfigs()).filter((config) => true);
    for (const config of configs) {
      if (!this.jobQueue) {
        return Logger.error(
          `Stocklevel sync jobQueue not initialized`,
          loggerCtx
        );
      }
      await this.jobQueue.add(
        { channelToken: config.channelToken },
        { retries: 2 }
      );
      return Logger.info(
        `Added stocklevel sync job to queue for channel ${config.channelToken}`,
        loggerCtx
      );
    }
    // Listen for Settled orders for autoFulfillment
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async (event) => {
      const config = await this.getConfig(event.ctx.channel.token);
      if (!config?.enabled || !config.autoFulfill) {
        return;
      }
      const order = await this.entityHydrator.hydrate(event.ctx, event.order, {
        relations: ['shippingLines', 'shippingLines.shippingMethod'],
      });
      const hasGoedgepicktHandler = order.shippingLines.some(
        (shippingLine) =>
          shippingLine.shippingMethod?.fulfillmentHandlerCode ===
          goedgepicktHandler.code
      );
      if (!hasGoedgepicktHandler) {
        return;
      }
      Logger.info(
        `Autofulfilling order ${order.code} for channel ${event.ctx.channel.token}`,
        loggerCtx
      );
      // TODO auto fulfill
    });
  }

  async upsertConfig(
    config: Partial<GoedgepicktConfigEntity>
  ): Promise<GoedgepicktConfigEntity> {
    const existing = await this.connection
      .getRepository(GoedgepicktConfigEntity)
      .findOne({ channelToken: config.channelToken });
    if (existing) {
      await this.connection
        .getRepository(GoedgepicktConfigEntity)
        .update(existing.id, config);
    } else {
      await this.connection
        .getRepository(GoedgepicktConfigEntity)
        .insert(config);
    }
    return this.connection
      .getRepository(GoedgepicktConfigEntity)
      .findOneOrFail({ channelToken: config.channelToken });
  }

  async getConfig(
    channelToken: string
  ): Promise<GoedgepicktConfigEntity | undefined> {
    return this.connection
      .getRepository(GoedgepicktConfigEntity)
      .findOne({ channelToken });
  }

  async getConfigs(): Promise<GoedgepicktConfigEntity[]> {
    return this.connection.getRepository(GoedgepicktConfigEntity).find();
  }

  /**
   * Push all products to Goedgepickt for channel
   */
  async pushProducts(channelToken: string): Promise<void> {
    const client = await this.getClientForChannel(channelToken);
    const [ggProducts, variants] = await Promise.all([
      client.getAllProducts(),
      this.getAllVariants(channelToken),
    ]);
    for (const variant of variants) {
      const product: ProductInput = {
        name: variant.name,
        sku: variant.sku,
        productId: variant.sku,
        stockManagement: true,
        url: `${this.config.vendureHost}/admin/catalog/products/${variant.productId};id=${variant.productId};tab=variants`,
        picture: variant.absoluteImageUrl,
        price: (variant.price / 100).toFixed(2),
      };
      const exists = ggProducts.find(
        (ggProduct) => ggProduct.sku === product.sku
      );
      try {
        if (exists) {
          await client.updateProduct(exists.uuid, product);
          Logger.info(`Updated ${variant.sku}`, loggerCtx);
        } else {
          await client.createProduct(product);
          Logger.info(`Created ${variant.sku}`, loggerCtx);
        }
      } catch (err) {
        // Don't throw, because we want other products to sync
        Logger.error(
          `Failed to push variant ${variant.sku}: ${err.message}`,
          loggerCtx,
          err
        );
      }
    }
    Logger.info(`Synced ${variants.length} to Goedgepickt`, loggerCtx);
  }

  /**
   * Set webhook and update secrets in DB
   */
  async setWebhooks(channelToken: string): Promise<GoedgepicktConfigEntity> {
    const client = await this.getClientForChannel(channelToken);
    const webhookTarget = this.getWebhookUrl(channelToken);
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
    return await this.upsertConfig({
      channelToken: channelToken,
      orderWebhookKey: orderSecret,
      stockWebhookKey: stockSecret,
    });
  }

  /**
   * Pull all stocklevels from Goedgepickt and update in Vendure
   */
  async pullStocklevels(channelToken: string): Promise<void> {
    const client = await this.getClientForChannel(channelToken);
    const variants = await this.getAllVariants(channelToken);
    const stockPerVariant: StockInput[] = [];
    const ggProducts = await client.getAllProducts();
    for (const ggProduct of ggProducts) {
      const variant = variants.find((v) => v.sku === ggProduct.sku);
      const newStock = ggProduct.stock?.freeStock;
      if (!newStock) {
        Logger.info(
          `Goedgepickt variant ${ggProduct.sku} has no stock set. Cannot update stock in Vendure for this variant.`,
          loggerCtx
        );
        continue;
      }
      if (variant) {
        stockPerVariant.push({
          variantId: variant.id as string,
          stock: newStock,
        });
      } else {
        Logger.info(
          `Goedgepickt product with sku ${ggProduct.sku} doesn't exist as variant in Vendure. Not updating stock for this variant`,
          loggerCtx
        );
      }
    }
    const ctx = await this.getCtxForChannel(channelToken);
    await this.updateStock(ctx, stockPerVariant);
    Logger.info(
      `Updated stockLevels of ${variants.length} variants for ${channelToken}`,
      loggerCtx
    );
  }

  /**
   * Accepts the order and corresponding orderItems, because fulfillment can take place for a partial order
   */
  async createOrder(
    channelToken: string,
    order: Order,
    orderItems: OrderItem[]
  ): Promise<GgOrder> {
    const ctx = await this.getCtxForChannel(channelToken);
    await this.entityHydrator.hydrate(ctx, order, { relations: ['customer'] });
    const mergedItems: OrderItemInput[] = [];
    // Merge same SKU's into single item with quantity
    orderItems.forEach((orderItem) => {
      const existingItem = mergedItems.find(
        (i) => i.sku === orderItem.line.productVariant.sku
      );
      if (existingItem) {
        existingItem.productQuantity++;
      } else {
        mergedItems.push({
          sku: orderItem.line.productVariant.sku,
          productName: orderItem.line.productVariant.name,
          productQuantity: 1, // OrderItems are always 1 each
          taxRate: orderItem.taxRate,
        });
      }
    });
    const client = await this.getClientForChannel(channelToken);
    if (
      !order.shippingAddress.streetLine2 ||
      !order.shippingAddress.streetLine1
    ) {
      throw Error(
        `Order.shippingAddress.streetLine1 and streetLine2 are needed to push order to Goedgepickt`
      );
    }
    const { houseNumber, addition } =
      GoedgepicktService.splitHouseNumberAndAddition(
        order.shippingAddress.streetLine2
      );
    return client.createOrder({
      orderId: order.code,
      createDate: order.createdAt,
      finishDate: order.orderPlacedAt,
      orderStatus: 'open',
      orderItems: mergedItems,
      shippingFirstName: order.customer?.firstName,
      shippingLastName: order.customer?.lastName,
      shippingCompany: order.shippingAddress.company,
      shippingAddress: order.shippingAddress.streetLine1,
      shippingHouseNumber: houseNumber,
      shippingHouseNumberAddition: addition,
      shippingZipcode: order.shippingAddress.postalCode!,
      shippingCity: order.shippingAddress.city!,
      shippingCountry: order.shippingAddress.countryCode!,
    });
  }

  /**
   * Update order status in Vendure based on event
   */
  async updateOrderStatus(
    channelToken: string,
    orderCode: string,
    newStatus: OrderStatus
  ): Promise<void> {
    const ctx = await this.getCtxForChannel(channelToken);
    let order = await this.orderService.findOneByCode(ctx, orderCode);
    if (!order) {
      throw Error(`Order with code ${orderCode} doesn't exists`);
    }
    if (newStatus !== 'completed') {
      return Logger.info(
        `No status updates needed for order ${orderCode} for status ${newStatus}`,
        loggerCtx
      );
    }
    await transitionToDelivered(this.orderService, ctx, order, {
      code: goedgepicktHandler.code,
      arguments: [],
    });
    Logger.info(`Updated orderstatus of ${orderCode}`, loggerCtx);
  }

  /**
   * Update stock in Vendure based on event
   */
  async processStockUpdateEvent(
    channelToken: string,
    productSku: string,
    newStock: number
  ): Promise<void> {
    const ctx = await this.getCtxForChannel(channelToken);
    const { items: variants } = await this.variantService.findAll(ctx, {
      filter: { sku: { eq: productSku } },
    });
    const updatedStock: StockInput[] = variants.map((variant) => ({
      variantId: variant.id as string,
      stock: newStock,
    }));
    await this.updateStock(ctx, updatedStock);
    Logger.info(
      `Updated stock for ${productSku} to ${newStock} via incoming event`,
      loggerCtx
    );
  }

  async getClientForChannel(channelToken: string): Promise<GoedgepicktClient> {
    const config = await this.getConfig(channelToken);
    if (!config || !config?.apiKey || !config.webshopUuid) {
      throw Error(`Incomplete config found for channel ${channelToken}`);
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

  private async getAllVariants(
    channelToken: string
  ): Promise<VariantWithImage[]> {
    let ctx = await this.getCtxForChannel(channelToken);
    const variants: VariantWithImage[] = [];
    let hasMore = true;
    let skip = 0;
    while (hasMore) {
      const result = await this.variantService.findAll(ctx, {
        skip,
        take: this.queryLimit,
        filter: {},
      });
      variants.push(...result.items);
      skip += this.queryLimit;
      hasMore = result.totalItems > result.items.length;
    }
    // Resolve images as if we are shop client
    const shopCtx = new RequestContext({
      apiType: 'shop',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      channel: ctx.channel,
    });
    // Hydrate with images
    return Promise.all(
      variants.map(async (variant) => {
        await this.entityHydrator.hydrate(ctx, variant, {
          relations: ['product', 'product.featuredAsset'],
        });
        let imageUrl =
          variant.featuredAsset?.preview ||
          variant.product.featuredAsset?.preview;
        if (
          this.configService.assetOptions.assetStorageStrategy.toAbsoluteUrl &&
          imageUrl
        ) {
          imageUrl = this.configService.assetOptions.assetStorageStrategy
            .toAbsoluteUrl!(shopCtx.req as any, imageUrl);
        }
        variant.absoluteImageUrl = imageUrl;
        return variant;
      })
    );
  }

  private async updateStock(
    ctx: RequestContext,
    stockInput: StockInput[]
  ): Promise<ProductVariant[]> {
    const positiveLevels = stockInput.map((input) => ({
      id: input.variantId,
      stockOnHand: input.stock >= 0 ? input.stock : 0,
    }));
    return this.variantService.update(ctx, positiveLevels);
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
}
