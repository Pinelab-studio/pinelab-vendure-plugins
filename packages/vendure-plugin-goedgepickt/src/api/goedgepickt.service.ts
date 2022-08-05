import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import {
  Channel,
  ChannelService,
  ConfigService,
  EntityHydrator,
  EventBus,
  ID,
  JobQueue,
  JobQueueService,
  Json,
  ListQueryBuilder,
  Logger,
  Order,
  OrderItem,
  OrderPlacedEvent,
  OrderService,
  ProductPriceApplicator,
  ProductVariant,
  ProductVariantEvent,
  ProductVariantService,
  RequestContext,
  TransactionalConnection,
  Translated,
  translateDeep,
} from '@vendure/core';
import { GoedgepicktClient } from './goedgepickt.client';
import {
  GoedgepicktEvent,
  GoedgepicktPluginConfig,
  Order as GgOrder,
  OrderInput,
  OrderItemInput,
  OrderStatus,
  Product,
  ProductInput,
} from './goedgepickt.types';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { GoedgepicktConfigEntity } from './goedgepickt-config.entity';
import { fulfillAll, transitionToDelivered } from '../../../util/src';
import { goedgepicktHandler } from './goedgepickt.handler';
import { PickupPointCustomFields } from './custom-fields';

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
  channelToken: string;
  products: ProductInput[];
}

interface PushProductByVariantsJobData {
  action: 'push-product-by-variants';
  channelToken: string;
  variants: ProductVariant[];
}

interface UpdateStockJobData {
  action: 'update-stock';
  channelToken: string;
  stock: StockInput[];
}

interface AutofulfillOrderJobData {
  action: 'autofulfill-order';
  channelToken: string;
  orderCode: string;
}

type JobData =
  | PushProductJobData
  | PushProductByVariantsJobData
  | UpdateStockJobData
  | AutofulfillOrderJobData;

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
    private connection: TransactionalConnection,
    private jobQueueService: JobQueueService,
    private orderService: OrderService,
    private entityHydrator: EntityHydrator,
    private listQueryBuilder: ListQueryBuilder,
    private eventBus: EventBus,
    private productPriceApplicator: ProductPriceApplicator
  ) {
    this.queryLimit = configService.apiOptions.adminListQueryLimit;
  }

  async onModuleInit() {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'goedgepickt-sync',
      process: async ({ data, id }) => {
        try {
          if (data.action === 'autofulfill-order') {
            await this.autoFulfill(data.channelToken, data.orderCode);
          } else if (data.action === 'push-product') {
            await this.handlePushProductJob(data);
          } else if (data.action === 'update-stock') {
            await this.updateStock(data.channelToken, data.stock);
          } else if (data.action === 'push-product-by-variants') {
            await this.handlePushByVariantsJob(data);
          }
          Logger.info(
            `Successfully processed job ${data.action} (${id}) for channel ${data.channelToken}`
          );
        } catch (error) {
          Logger.warn(
            `Failed to process job ${data.action} (${id}) for channel ${data.channelToken}: ${error}`,
            loggerCtx
          );
          throw error;
        }
      },
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    // Listen for Settled orders for autoFulfillment
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async (event) => {
      await this.jobQueue.add(
        {
          action: 'autofulfill-order',
          orderCode: event.order.code,
          channelToken: event.ctx.channel.token,
        },
        { retries: 10 }
      );
    });
    // Listen for Variant changes
    this.eventBus
      .ofType(ProductVariantEvent)
      .subscribe(async ({ ctx, variants, type }) => {
        if (type !== 'created') {
          return;
        }
        await this.jobQueue.add(
          {
            action: 'push-product-by-variants',
            channelToken: ctx.channel.token,
            variants: variants,
          },
          { retries: 10 }
        );
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
      createDate: GoedgepicktService.toLocalTime(order.createdAt)!,
      finishDate: GoedgepicktService.toLocalTime(order.orderPlacedAt),
      orderStatus: 'open',
      orderItems: mergedItems,
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
    return client.createOrder(orderInput);
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
      Logger.warn(
        `Order with code ${orderCode} doesn't exists. Not updating status to ${newStatus} for this order in channel ${channelToken}`,
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
    await this.updateStock(ctx.channel.token, updatedStock);
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

  /**
   * Creates 2 types of jobs: jobs for pushing products and jobs for updating stocklevels
   */
  async createFullsyncJobs(channelToken: string) {
    const client = await this.getClientForChannel(channelToken);
    const [ggProducts, variants] = await Promise.all([
      client.getAllProducts(),
      this.getAllVariants(channelToken),
    ]);
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
          channelToken,
          products: batch,
        },
        { retries: 20 }
      );
      Logger.info(
        `Created PushProducts job for ${batch.length} variants for channel ${channelToken}`,
        loggerCtx
      );
    }
    // Create update stocklevel jobs 100 variants per job
    const stockPerVariant: StockInput[] = [];
    for (const ggProduct of ggProducts) {
      const newStock = ggProduct.stock?.freeStock;
      if (!newStock) {
        continue; // Not updating if no stock from GG
      }
      const variant = variants.find((v) => v.sku === ggProduct.sku);
      if (!variant) {
        continue; // Not updating if we have no variant with SKU
      }
      stockPerVariant.push({
        variantId: variant.id as string,
        stock: newStock,
      });
    }
    const stockBatches = this.getBatches(stockPerVariant, 100);
    for (const batch of stockBatches) {
      await this.jobQueue.add(
        {
          action: 'update-stock',
          stock: batch,
          channelToken: channelToken,
        },
        { retries: 5 }
      );
      Logger.info(
        `Created stocklevel update job for ${batch.length} variants`,
        loggerCtx
      );
    }
  }

  /**
   * Create or update product in Goedgepickt based on given productInput
   */
  async handlePushProductJob({
    products,
    channelToken,
  }: PushProductJobData): Promise<void> {
    const client = await this.getClientForChannel(channelToken);
    for (const product of products) {
      if (product.uuid) {
        await client.updateProduct(product.uuid, product);
        Logger.debug(`Updated variant ${product.sku}`, loggerCtx);
      } else {
        await client.createProduct(product);
        Logger.debug(`Created variant ${product.sku}`, loggerCtx);
      }
    }
    Logger.info(
      `Pushed ${products.length} products to GoedGepickt for channel ${channelToken}`,
      loggerCtx
    );
  }

  /**
   * Create or update products in Goedgepickt based on given Vendure variants
   * Waits for 1 minute every 30 products, because of Goedgepickts rate limit
   */
  async handlePushByVariantsJob({
    channelToken,
    variants,
  }: PushProductByVariantsJobData): Promise<void> {
    const client = await this.getClientForChannel(channelToken);
    const channel = await this.channelService.getChannelFromToken(channelToken);
    const batches = this.getBatches(variants, 15);
    for (const batch of batches) {
      for (const variant of batch) {
        const existing = await client.findProductBySku(variant.sku);
        const product = this.mapToProductInput(
          this.setAbsoluteImage(channel, variant)
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
      await new Promise((resolve) => setTimeout(resolve, 62000));
    }
    Logger.info(
      `Pushed ${variants.length} variants to GoedGepickt for channel ${channelToken}`
    );
  }

  private async getAllVariants(
    channelToken: string
  ): Promise<VariantWithImage[]> {
    let ctx = await this.getCtxForChannel(channelToken);
    const translatedVariants: VariantWithImage[] = [];
    const take = 100;
    let skip = 0;
    let hasMore = true;
    while (hasMore) {
      const variants = await this.listQueryBuilder
        .build(
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
            where: { deletedAt: null },
            ctx,
          }
        )
        .getMany();
      hasMore = !!variants.length;
      skip += take;
      const variantsWithPrice = await Promise.all(
        variants.map((v) =>
          this.productPriceApplicator.applyChannelPriceAndTax(v, ctx)
        )
      );
      const mappedVariants = variantsWithPrice
        .map((v) => translateDeep(v, ctx.languageCode))
        .map((v) => this.setAbsoluteImage(ctx.channel, v));
      translatedVariants.push(...mappedVariants);
    }
    return translatedVariants;
  }

  private setAbsoluteImage(
    channel: Channel,
    variant: Translated<ProductVariant> | ProductVariant
  ): VariantWithImage {
    // Resolve images as if we are shop client
    const shopCtx = new RequestContext({
      apiType: 'shop',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      channel,
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

  private async updateStock(
    channelToken: string,
    stockInput: StockInput[]
  ): Promise<ProductVariant[]> {
    const ctx = await this.getCtxForChannel(channelToken);
    const positiveLevels = stockInput.map((input) => ({
      id: input.variantId,
      stockOnHand: input.stock >= 0 ? input.stock : 0,
    }));
    return this.variantService.update(ctx, positiveLevels);
  }

  private async autoFulfill(
    channelToken: string,
    orderCode: string
  ): Promise<void> {
    const ctx = await this.getCtxForChannel(channelToken);
    const config = await this.getConfig(channelToken);
    if (!config?.enabled || !config.autoFulfill) {
      return;
    }
    Logger.info(
      `Autofulfilling order ${orderCode} for channel ${channelToken}`,
      loggerCtx
    );
    let order = await this.orderService.findOneByCode(ctx, orderCode);
    if (!order) {
      Logger.error(
        `No order found with code ${orderCode}. Can not autofulfill this order.`,
        loggerCtx
      );
      return;
    }
    order = await this.entityHydrator.hydrate(ctx, order, {
      relations: ['shippingLines', 'shippingLines.shippingMethod'],
    });
    const hasGoedgepicktHandler = order.shippingLines.some(
      (shippingLine) =>
        shippingLine.shippingMethod?.fulfillmentHandlerCode ===
        goedgepicktHandler.code
    );
    if (!hasGoedgepicktHandler) {
      Logger.info(
        `Order ${order.code} does not have Goedgepickt set as handler. Not autofulfilling this order.`,
        loggerCtx
      );
      return;
    }
    await fulfillAll(ctx, this.orderService, order, {
      code: goedgepicktHandler.code,
      arguments: [],
    });
    Logger.info(`Order ${order.code} autofulfilled`, loggerCtx);
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
