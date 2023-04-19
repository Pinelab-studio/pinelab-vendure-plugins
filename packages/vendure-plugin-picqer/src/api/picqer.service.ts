import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
  UpdateProductInput,
  UpdateProductVariantInput,
} from '@vendure/common/lib/generated-types';
import {
  Address,
  AssetService,
  ChannelService,
  ConfigService,
  Customer,
  EntityHydrator,
  EventBus,
  ForbiddenError,
  ID,
  JobQueue,
  JobQueueService,
  Logger,
  Order,
  OrderPlacedEvent,
  OrderService,
  ProductEvent,
  ProductService,
  ProductVariant,
  ProductVariantEvent,
  ProductVariantService,
  RequestContext,
  SerializedRequestContext,
  TransactionalConnection,
} from '@vendure/core';
import currency from 'currency.js';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { PicqerOptions } from '../picqer.plugin';
import {
  PicqerConfig,
  PicqerConfigInput,
  TestPicqerInput,
} from '../ui/generated/graphql';
import { PicqerConfigEntity } from './picqer-config.entity';
import { PicqerClient, PicqerClientInput } from './picqer.client';
import {
  AddressInput,
  CustomerInput,
  IncomingWebhook,
  OrderInput,
  OrderProductInput,
  ProductData,
  ProductInput,
  VariantWithStock,
} from './types';

/**
 * Job to push variants from Vendure to Picqer
 */
interface PushVariantsJob {
  action: 'push-variants';
  ctx: SerializedRequestContext;
  variantIds?: ID[];
  productId?: ID;
}

/**
 * Job to pull stock levels from Picqer into Vendure
 */
interface PullStockLevelsJob {
  action: 'pull-stock-levels';
  ctx: SerializedRequestContext;
  variantIds?: ID[];
  productId?: ID;
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
    private productService: ProductService,
    private assetService: AssetService,
    private configService: ConfigService,
    private entityHydrator: EntityHydrator,
    private channelService: ChannelService,
    private orderService: OrderService
  ) {}

  async onApplicationBootstrap() {
    // Create JobQueue and handlers
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'picqer-sync',
      process: async ({ data }) => {
        const ctx = RequestContext.deserialize(data.ctx);
        try {
          if (data.action === 'push-variants') {
            await this.handlePushVariantsJob(
              ctx,
              data.variantIds,
              data.productId
            );
          } else if (data.action === 'pull-stock-levels') {
            await this.handlePullStockLevelsJob(ctx);
          } else if (data.action === 'push-order') {
            await this.handlePushOrderJob(ctx, data.orderId);
          } else {
            Logger.error(
              `Invalid job action: ${(data as any).action}`,
              loggerCtx
            );
          }
        } catch (e: unknown) {
          if (e instanceof Error) {
            // Only log a warning, because this is a background function that will be retried by the JobQueue
            Logger.warn(
              `Failed to handle job '${data.action}': ${e?.message}`,
              loggerCtx
            );
          }
          throw e;
        }
      },
    });
    // Listen for Variant creation or update
    this.eventBus
      .ofType(ProductVariantEvent)
      .subscribe(async ({ ctx, entity, type }) => {
        if (type === 'created' || type === 'updated') {
          await this.addPushVariantsJob(
            ctx,
            entity.map((v) => v.id)
          );
        }
      });
    // Listen for Product events. Only push variants when product is enabled/disabled. Other changes are handled by the variant events.
    this.eventBus
      .ofType(ProductEvent)
      .subscribe(async ({ ctx, entity, type, input }) => {
        // Only push if `enabled` is updated
        if (
          type === 'updated' &&
          (input as UpdateProductInput).enabled !== undefined
        ) {
          await this.addPushVariantsJob(ctx, undefined, entity.id);
        }
      });
    // Listen for Order placed events
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async ({ ctx, order }) => {
      // Only push if `enabled` is updated
      await this.addPushOrderJob(ctx, order);
    });
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
    for (const hookEvent of ['products.free_stock_changed' as const]) {
      // TODO add order hook
      // Use first 4 digits of webhook secret as name, so we can identify the hook
      const webhookName = `Vendure ${hookEvent} ${client.webhookSecret.slice(
        0,
        4
      )}`;
      const webhooks = await client.getWebhooks();
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
    if (input.body.event === 'products.free_stock_changed') {
      const picqerProduct = input.body.data;
      await this.updateStockBySkus(ctx, [picqerProduct]);
    } else {
      Logger.warn(
        `Invalid event ${input.body.event} for incoming webhook for channel ${input.channelToken}`,
        loggerCtx
      );
      return;
    }
    Logger.info(`Successfully handled hook ${input.body.event}`, loggerCtx);
  }

  async triggerFullSync(ctx: RequestContext): Promise<boolean> {
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
    await this.jobQueue.add(
      {
        action: 'pull-stock-levels',
        ctx: ctx.serialize(),
      },
      { retries: 10 }
    );
    Logger.info(`Added 'pull-stock-levels' job to queue`, loggerCtx);
    return true;
  }

  /**
   * Add a job to the queue to push variants to Picqer
   */
  async addPushVariantsJob(
    ctx: RequestContext,
    variantIds?: ID[],
    productId?: ID
  ): Promise<void> {
    await this.jobQueue.add(
      {
        action: 'push-variants',
        ctx: ctx.serialize(),
        variantIds,
        productId,
      },
      { retries: 10 }
    );
    if (variantIds) {
      Logger.info(
        `Added job to the 'push-variants' queue for ${variantIds.length} variants for channel ${ctx.channel.token}`,
        loggerCtx
      );
    } else {
      Logger.info(
        `Added job to the 'push-variants' queue for product ${productId} and channel ${ctx.channel.token}`,
        loggerCtx
      );
    }
  }

  /**
   * Add a job to the queue to push orders to Picqer
   */
  async addPushOrderJob(ctx: RequestContext, order: Order): Promise<void> {
    await this.jobQueue.add(
      {
        action: 'push-order',
        ctx: ctx.serialize(),
        orderId: order.id,
      },
      { retries: 10 }
    );
    Logger.info(
      `Added job to the 'push-order' queue for order ${order.code}`,
      loggerCtx
    );
  }

  /**
   * Pulls all products from Picqer and updates the stock levels in Vendure
   * based on the stock levels from Picqer products
   */
  async handlePullStockLevelsJob(userCtx: RequestContext): Promise<void> {
    const ctx = this.createDefaultLanguageContext(userCtx);
    const client = await this.getClient(ctx);
    if (!client) {
      return;
    }
    const picqerProducts = await client.getAllActiveProducts();
    await this.updateStockBySkus(ctx, picqerProducts);
    Logger.info(`Successfully pulled stock levels from Picqer`, loggerCtx);
  }

  /**
   * Update variant stocks in Vendure based on given Picqer products
   */
  async updateStockBySkus(
    ctx: RequestContext,
    picqerProducts: ProductData[]
  ): Promise<void> {
    const vendureVariants = await this.findAllVariantsBySku(
      ctx,
      picqerProducts.map((p) => p.productcode)
    );
    const updateVariantsInput: UpdateProductVariantInput[] = [];
    // Determine new stock level per variant
    vendureVariants.forEach((variant) => {
      const picqerProduct = picqerProducts.find(
        (p) => p.productcode === variant.sku
      );
      if (!picqerProduct) {
        return; // Should never happen
      }
      const picqerStockLevel = picqerProduct?.stock?.[0]?.freestock;
      if (!picqerStockLevel) {
        Logger.info(
          `Picqer product ${picqerProduct.idproduct} (sku ${picqerProduct.productcode}) has no stock set, not updating variant in Vendure`,
          loggerCtx
        );
      }
      const newStockOnHand = variant.stockAllocated + (picqerStockLevel || 0);
      // Fields from picqer that should be added to the variant
      let additionalVariantFields = {};
      try {
        additionalVariantFields =
          this.options.pullFieldsFromPicqer?.(picqerProduct) || {};
      } catch (e: any) {
        Logger.error(
          `Failed to get additional fields from the configured pullFieldsFromPicqer function: ${e?.message}`,
          loggerCtx
        );
      }
      updateVariantsInput.push({
        ...additionalVariantFields,
        id: variant.id,
        stockOnHand: newStockOnHand,
      });
    });
    // Use raw connection for better performance
    await Promise.all(
      updateVariantsInput.map(async (v) =>
        this.connection
          .getRepository(ctx, ProductVariant)
          .update({ id: v.id }, v)
      )
    );
    Logger.info(
      `Updated stock levels of ${updateVariantsInput.length} variants`,
      loggerCtx
    );
  }

  /**
   * Fetch order with relations and push it as order to Picqer
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
      'lines.productVariant.taxCategory',
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
    Logger.info(`Pushing order ${order.code} to Picqer...`, loggerCtx);
    if (!order.customer) {
      Logger.error(
        `Order ${order.code} doesn't have a customer, ignoring this order...`,
        loggerCtx
      );
      return;
    }
    const picqerCustomer = await client.createOrUpdateCustomer(
      order.customer?.emailAddress,
      this.mapToCustomerInput(order.customer)
    );
    const vatGroups = await client.getVatGroups();
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
      const picqerProduct = await client.createOrUpdateProduct(
        line.productVariant.sku,
        this.mapToProductInput(line.productVariant, vatGroup.idvatgroup)
      );
      productInputs.push({
        idproduct: picqerProduct.idproduct,
        amount: line.quantity,
      });
    }
    const createdorder = await client.createOrder(
      this.mapToOrderInput(order, picqerCustomer.idcustomer, productInputs)
    );
    Logger.info(
      `Created order "${order.code}" in Picqer with id ${createdorder.idorder}`,
      loggerCtx
    );
  }

  /**
   * Find all variants by SKUS via raw connection for better performance
   */
  async findAllVariantsBySku(
    ctx: RequestContext,
    skus: string[]
  ): Promise<VariantWithStock[]> {
    let skip = 0;
    const take = 1000;
    let hasMore = true;
    const allVariants: VariantWithStock[] = [];
    while (hasMore) {
      // Only select minimal fields, not the whole entities
      const [variants, count] = await this.connection
        .getRepository(ctx, ProductVariant)
        .createQueryBuilder('variant')
        .select([
          'variant.id',
          'variant.sku',
          'variant.stockOnHand',
          'variant.stockAllocated',
        ])
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
    variantIds?: ID[],
    productId?: ID
  ): Promise<void> {
    const ctx = this.createDefaultLanguageContext(userCtx);
    const client = await this.getClient(ctx);
    if (!client) {
      return;
    }
    // Get variants by ID or by ProductId
    let variants: ProductVariant[] | undefined;
    if (variantIds) {
      variants = await this.variantService.findByIds(ctx, variantIds);
    } else if (productId) {
      const product = await this.productService.findOne(ctx, productId);
      if (!product) {
        Logger.warn(
          `Could not find product with id ${productId} for push-variants job`,
          loggerCtx
        );
        return;
      }
      // Separate hydration is needed for taxRateApplied and variant prices
      await this.entityHydrator.hydrate(ctx, product, {
        relations: ['variants'],
        applyProductVariantPrices: true,
      });
      variants = product.variants;
      if (!product.enabled) {
        // Disable all variants if the product is disabled
        variants.forEach((v) => (v.enabled = false));
      }
    } else {
      throw Error('No variantIds or productId provided');
    }
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
          const existing = await client.getProductByCode(variant.sku);
          const productInput = this.mapToProductInput(
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
        } catch (e: any) {
          throw new Error(
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
      channelId: String(ctx.channelId),
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
      channelId: String(ctx.channelId),
    });
    await this.registerWebhooks(ctx, config).catch((e) =>
      Logger.error(
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
      config = await this.getConfig(ctx);
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
    return new PicqerClient(config as PicqerClientInput);
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
    if (!asset?.preview) {
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
  async getConfig(ctx: RequestContext): Promise<PicqerConfig | undefined> {
    const repository = this.connection.getRepository(ctx, PicqerConfigEntity);
    return repository.findOne({ channelId: String(ctx.channelId) });
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
      addresses: customer.addresses.map(this.mapToAddressInput),
    };
  }

  mapToAddressInput(address: Address): AddressInput {
    return {
      name: address.fullName,
      address: `${address.streetLine1} ${address.streetLine2}`,
      zipcode: address.postalCode,
      city: address.city,
      country: address.country?.code.toUpperCase(),
      defaultdelivery: address.defaultShippingAddress,
      defaultinvoice: address.defaultBillingAddress,
    };
  }

  mapToProductInput(variant: ProductVariant, vatGroupId: number): ProductInput {
    const additionalFields = this.options.pushFieldsToPicqer?.(variant) || {};
    if (!variant.sku) {
      throw Error(`Variant with ID ${variant.id} has no SKU`);
    }
    return {
      ...additionalFields,
      idvatgroup: vatGroupId,
      name: variant.name || variant.sku, // use SKU if no name set
      price: currency(variant.price / 100).value, // Convert to float with 2 decimals
      productcode: variant.sku,
      active: variant.enabled,
    };
  }

  mapToOrderInput(
    order: Order,
    customerId: number,
    products: OrderProductInput[]
  ): OrderInput {
    const shippingAddress = order.shippingAddress;
    const billingAddress = order.billingAddress || order.shippingAddress;
    return {
      idcustomer: customerId,
      reference: order.code,
      deliveryname: shippingAddress.company || shippingAddress.fullName,
      deliverycontactname: shippingAddress.fullName,
      deliveryaddress: `${shippingAddress.streetLine1} ${shippingAddress.streetLine2}`,
      deliveryzipcode: shippingAddress.postalCode,
      deliverycountry: shippingAddress.country?.toUpperCase(),
      invoicename: billingAddress.company || billingAddress.fullName,
      invoicecontactname: billingAddress.fullName,
      invoiceaddress: `${shippingAddress.streetLine1} ${shippingAddress.streetLine2}`,
      invoicezipcode: shippingAddress.postalCode,
      invoicecity: shippingAddress.city,
      invoicecountry: shippingAddress.country?.toUpperCase(),
      products,
    };
  }
}
