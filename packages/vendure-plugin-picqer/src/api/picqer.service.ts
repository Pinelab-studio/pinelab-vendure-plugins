import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { UpdateProductInput } from '@vendure/common/lib/generated-types';
import {
  AssetService,
  ConfigService,
  EntityHydrator,
  EventBus,
  ID,
  JobQueue,
  JobQueueService,
  Logger,
  OrderPlacedEvent,
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
import { ProductInput, ProductResponse } from './types';

interface PushVariantsJob {
  action: 'push-variants';
  ctx: SerializedRequestContext;
  variantIds?: ID[];
  productId?: ID;
}

type JobData = PushVariantsJob; // TODO | PullStockLevelsJob | PushOrderJob

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
    private entityHydrator: EntityHydrator
  ) {}

  async onApplicationBootstrap() {
    // Create JobQueue and handlers
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'picqer-sync',
      process: async ({ data, id }) => {
        const ctx = RequestContext.deserialize(data.ctx);
        try {
          if (data.action === 'push-variants') {
            await this.pushVariantsToPicqer(
              ctx,
              data.variantIds,
              data.productId
            );
          } else {
            Logger.error(`Invalid job action: ${data.action}`, loggerCtx);
          }
        } catch (e: unknown) {
          if (e instanceof Error) {
            Logger.error(
              `Failed to handle job '${data.action}': ${e?.message}`,
              loggerCtx
            );
          }
          throw e;
        }
      },
    });
    // Listen for placed orders
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async ({ ctx, order }) => {
      // TODO push order sync
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
    // Listen for Product events
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
    const totalVariants = variantIds.length;
    // Create batches of 10
    while (variantIds.length) {
      await this.addPushVariantsJob(ctx, variantIds.splice(0, 10));
    }
    Logger.info(
      `Pushed ${totalVariants} variants to the job queue for channel ${ctx.channel.token} by user ${ctx.activeUserId}`,
      loggerCtx
    );
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
      { retries: 5 }
    );
  }

  /**
   * Creates or updates products in Picqer based on the given variantIds.
   * Checks for existance of SKU in Picqer and updates if found.
   * If not found, creates a new product.
   */
  async pushVariantsToPicqer(
    ctx: RequestContext,
    variantIds?: ID[],
    productId?: ID
  ): Promise<void> {
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
          console.log('=============', existing);
          const productInput = this.mapToProductInput(
            variant,
            vatGroup.idvatgroup
          );
          let picqerProduct: ProductResponse | undefined;
          if (existing?.idproduct) {
            // Update existing Picqer product
            picqerProduct = await client.updateProduct(
              existing.idproduct,
              productInput
            );
            Logger.info(
              `Updated variant ${variant.sku} in Picqer (Picqer id: ${existing.idproduct}) for channel ${ctx.channel.token}`,
              loggerCtx
            );
          } else {
            // Create new variant if no product exists in Picqer
            picqerProduct = await client.createProduct(productInput);
            Logger.info(
              `Created variant ${variant.sku} in Picqer (Picqer id: ${picqerProduct.idproduct}) for channel ${ctx.channel.token}`,
              loggerCtx
            );
          }
          // Update imags
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
          // Only log a warning, because this is a background function that will be retried by the JobQueue
          Logger.warn(
            `Error pushing variant ${variant.sku} to Picqer: ${e?.message}`,
            loggerCtx
          );
          throw e;
        }
      })
    );
  }

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
    return repository.findOneOrFail({ channelId: String(ctx.channelId) });
  }

  /**
   * Get a Picqer client for the current channel if the config is complete and enabled.
   */
  async getClient(ctx: RequestContext): Promise<PicqerClient | undefined> {
    const config = await this.getConfig(ctx);
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
    if (!asset?.preview && variant.product) {
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

  private mapToProductInput(
    variant: ProductVariant,
    vatGroupId: number
  ): ProductInput {
    const additionalFields = this.options.pushFieldsToPicqer?.(variant) || {};
    return {
      ...additionalFields,
      idvatgroup: vatGroupId,
      name: variant.name,
      price: currency(variant.price / 100).value, // Convert to float with 2 decimals
      productcode: variant.sku,
      active: variant.enabled,
    };
  }
}
