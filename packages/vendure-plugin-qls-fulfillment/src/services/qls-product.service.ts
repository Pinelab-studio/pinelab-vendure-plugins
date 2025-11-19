import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import {
  EventBus,
  ID,
  Job,
  JobQueue,
  JobQueueService,
  ListQueryBuilder,
  Logger,
  ProductPriceApplicator,
  ProductVariant,
  ProductVariantEvent,
  ProductVariantService,
  RequestContext,
  StockLevel,
  StockLevelService,
  StockLocationService,
  TransactionalConnection,
  translateDeep,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import { IsNull } from 'typeorm';
import util from 'util';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { FulfillmentProduct } from '../lib/client-types';
import { getQlsClient, QlsClient } from '../lib/qls-client';
import { QlsPluginOptions, QlsProductJobData } from '../types';

type SyncProductsJobResult = {
  updatedInQls: number;
  createdInQls: number;
  updatedStock: number;
};

@Injectable()
export class QlsProductService implements OnModuleInit, OnApplicationBootstrap {
  private productJobQueue!: JobQueue<QlsProductJobData>;

  constructor(
    private connection: TransactionalConnection,
    @Inject(PLUGIN_INIT_OPTIONS) private options: QlsPluginOptions,
    private jobQueueService: JobQueueService,
    private stockLevelService: StockLevelService,
    private readonly variantService: ProductVariantService,
    private readonly stockLocationService: StockLocationService,
    private readonly eventBus: EventBus,
    private readonly listQueryBuilder: ListQueryBuilder,
    private readonly productPriceApplicator: ProductPriceApplicator
  ) {}

  onApplicationBootstrap(): void {
    // Listen for ProductVariantEvent and add a job to the queue
    this.eventBus.ofType(ProductVariantEvent).subscribe((event) => {
      if (event.type !== 'created' && event.type !== 'updated') {
        return;
      }
      this.triggerSyncVariants(
        event.ctx,
        event.entity.map((v) => v.id)
      ).catch((e) => {
        const error = asError(e);
        Logger.error(
          `Error adding job to queue: ${error.message}`,
          loggerCtx,
          error.stack
        );
      });
    });
  }

  public async onModuleInit(): Promise<void> {
    this.productJobQueue = await this.jobQueueService.createQueue({
      name: 'qls-product-jobs',
      process: (job) => {
        return this.handleProductJob(job);
      },
    });
  }

  /**
   * Decide what kind of job it is and handle accordingly.
   * Returns the result of the job, which will be stored in the job record.
   */
  async handleProductJob(job: Job<QlsProductJobData>): Promise<unknown> {
    try {
      const ctx = RequestContext.deserialize(job.data.ctx);
      if (job.data.action === 'full-sync-products') {
        return await this.runFullSync(ctx);
      } else if (job.data.action === 'sync-products') {
        return await this.syncVariants(ctx, job.data.productVariantIds);
      }
      throw new Error(
        `Unknown job action: ${(job.data as QlsProductJobData).action}`
      );
    } catch (e) {
      const error = asError(e);
      const dataWithoutCtx = {
        ...job.data,
        ctx: undefined,
      };
      Logger.error(
        `Error handling job ${job.data.action}: ${error}`,
        loggerCtx,
        util.inspect(dataWithoutCtx, false, 5)
      );
      throw error;
    }
  }

  /**
   * Create fulfillment products in QLS for all product variants (full push)
   * 1. Fetches all products from QLS
   * 2. Updates stock levels in Vendure based on the QLS products
   * 3. Creates products in QLS if needed
   * 4. Updates products in QLS if needed
   */
  async runFullSync(ctx: RequestContext): Promise<SyncProductsJobResult> {
    try {
      const client = await getQlsClient(ctx, this.options);
      if (!client) {
        throw new Error(`QLS not enabled for channel ${ctx.channel.token}`);
      }
      Logger.info(
        `Running full sync for channel ${ctx.channel.token}`,
        loggerCtx
      );
      const allQlsProducts = await client.getAllFulfillmentProducts();
      const allVariants = await this.getAllVariants(ctx);
      Logger.info(
        `Running full sync for ${allQlsProducts.length} QLS products and ${allVariants.length} Vendure variants`,
        loggerCtx
      );
      // Update stock in Vendure based on QLS products
      let updateStockCount = 0;
      for (const variant of allVariants) {
        const qlsProduct = allQlsProducts.find((p) => p.sku == variant.sku);
        if (qlsProduct) {
          await this.updateStock(ctx, variant.id, qlsProduct.amount_available);
          updateStockCount += 1;
        }
      }
      Logger.info(
        `Updated stock for ${updateStockCount} variants based on QLS stock levels`,
        loggerCtx
      );
      // Create or update products in QLS
      let createdQlsProductsCount = 0;
      let updatedQlsProductsCount = 0;
      for (const variant of allVariants) {
        try {
          const existingQlsProduct = allQlsProducts.find(
            (p) => p.sku == variant.sku
          );
          const result = await this.createOrUpdateProductInQls(
            ctx,
            client,
            variant,
            existingQlsProduct ?? null
          );
          if (result === 'created') {
            createdQlsProductsCount += 1;
          } else if (result === 'updated') {
            updatedQlsProductsCount += 1;
          }
        } catch (e) {
          const error = asError(e);
          Logger.error(
            `Error creating or updating variant '${variant.sku}' in QLS: ${error.message}`,
            loggerCtx,
            error.stack
          );
        }
      }
      Logger.info(
        `Created ${createdQlsProductsCount} products in QLS`,
        loggerCtx
      );
      Logger.info(
        `Updated ${updatedQlsProductsCount} products in QLS`,
        loggerCtx
      );
      return {
        updatedInQls: updatedQlsProductsCount,
        createdInQls: createdQlsProductsCount,
        updatedStock: updateStockCount,
      };
    } catch (e) {
      const error = asError(e);
      Logger.error(
        `Error running full sync: ${error.message}`,
        loggerCtx,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Creates or updates the fulfillment products in QLS for the given product variants.
   */
  async syncVariants(
    ctx: RequestContext,
    productVariantIds: ID[]
  ): Promise<SyncProductsJobResult> {
    const client = await getQlsClient(ctx, this.options);
    if (!client) {
      Logger.debug(
        `QLS not enabled for channel ${ctx.channel.token}. Not handling product update/create.`,
        loggerCtx
      );
      return {
        updatedInQls: 0,
        createdInQls: 0,
        updatedStock: 0,
      };
    }
    let updatedInQls = 0;
    let createdInQls = 0;
    for (const variantId of productVariantIds) {
      const variant = await this.variantService.findOne(ctx, variantId);
      if (!variant) {
        Logger.error(
          `Variant with id ${variantId} not found. Not creating or updating product in QLS.`,
          loggerCtx
        );
        continue;
      }
      const existingQlsProduct = await client.getFulfillmentProductBySku(
        variant.sku
      );
      const result = await this.createOrUpdateProductInQls(
        ctx,
        client,
        variant,
        existingQlsProduct ?? null
      );
      if (result === 'created') {
        createdInQls += 1;
      } else if (result === 'updated') {
        updatedInQls += 1;
      }
    }
    return {
      updatedInQls,
      createdInQls,
      updatedStock: 0,
    };
  }

  /**
   * Trigger a full product sync job
   */
  async triggerFullSync(ctx: RequestContext) {
    return this.productJobQueue.add(
      {
        action: 'full-sync-products',
        ctx: ctx.serialize(),
      },
      { retries: 5 }
    );
  }

  /**
   * Trigger a product sync job for particular product variants
   */
  async triggerSyncVariants(ctx: RequestContext, productVariantIds: ID[]) {
    const client = await getQlsClient(ctx, this.options);
    if (!client) {
      Logger.debug(
        `QLS not enabled for channel ${ctx.channel.token}. Not triggering product sync.`,
        loggerCtx
      );
      return;
    }
    return this.productJobQueue.add(
      {
        action: 'sync-products',
        ctx: ctx.serialize(),
        productVariantIds,
      },
      { retries: 5 }
    );
  }

  /**
   * Update the stock level for a variant based on the given available stock
   */
  async updateStockBySku(
    ctx: RequestContext,
    sku: string,
    availableStock: number
  ) {
    const result = await this.variantService.findAll(ctx, {
      filter: { sku: { eq: sku } },
    });
    if (!result.items.length) {
      throw new Error(`Variant with sku '${sku}' not found`);
    }
    const variant = result.items[0];
    if (result.items.length > 1) {
      Logger.error(
        `Multiple variants found for sku '${sku}', using '${variant.id}'`,
        loggerCtx
      );
    }
    return this.updateStock(ctx, variant.id, availableStock);
  }

  /**
   * Determines if a product needs to be created or updated in QLS based on the given variant and existing QLS product.
   */
  async createOrUpdateProductInQls(
    ctx: RequestContext,
    client: QlsClient,
    variant: ProductVariant,
    existingProduct: FulfillmentProduct | null
  ): Promise<'created' | 'updated' | 'not-changed'> {
    let qlsProductId = existingProduct?.id;
    let createdOrUpdated: 'created' | 'updated' | 'not-changed' = 'not-changed';
    if (!existingProduct) {
      const result = await client.createFulfillmentProduct({
        name: variant.name,
        sku: variant.sku,
        ...this.options.getAdditionalVariantFields?.(ctx, variant),
      });
      qlsProductId = result.id;
      Logger.info(`Created product '${variant.sku}' in QLS`, loggerCtx);
      createdOrUpdated = 'created';
    } else if (this.shouldUpdateProductInQls(ctx, variant, existingProduct)) {
      await client.updateFulfillmentProduct(existingProduct.id, {
        sku: variant.sku,
        name: variant.name,
        ...this.options.getAdditionalVariantFields?.(ctx, variant),
      });
      Logger.info(`Updated product '${variant.sku}' in QLS`, loggerCtx);
      createdOrUpdated = 'updated';
    }
    if (qlsProductId !== variant.customFields.qlsProductId) {
      // Update variant with QLS product ID if it changed
      // Do not use variantService.update because it will trigger a change event and cause an infinite loop
      await this.connection
        .getRepository(ctx, ProductVariant)
        .update({ id: variant.id }, { customFields: { qlsProductId } });
      Logger.info(
        `Set QLS product ID for variant '${variant.sku}' to ${qlsProductId}`,
        loggerCtx
      );
    }
    return createdOrUpdated;
  }

  /**
   * Determine if a product needs to be updated in QLS based on the given variant and QLS product.
   */
  private shouldUpdateProductInQls(
    ctx: RequestContext,
    variant: ProductVariant,
    qlsProduct: FulfillmentProduct
  ): boolean {
    const additionalFields = this.options.getAdditionalVariantFields?.(
      ctx,
      variant
    );
    if (
      qlsProduct.name !== variant.name ||
      qlsProduct.ean !== additionalFields?.ean ||
      qlsProduct.image_url !== additionalFields?.image_url
    ) {
      // If name or ean has changed, product should be updated in QLS
      return true;
    }
    return false;
  }

  /**
   * Get all variants for the current channel in batches
   */
  private async getAllVariants(ctx: RequestContext): Promise<ProductVariant[]> {
    const allVariants: ProductVariant[] = [];
    let skip = 0;
    const take = 100;
    let hasMore = true;
    while (hasMore) {
      const relations = [
        'featuredAsset',
        'taxCategory',
        'channels',
        'product.featuredAsset',
      ];
      const [items, totalItems] = await this.listQueryBuilder
        .build(
          ProductVariant,
          {
            skip,
            take,
          },
          {
            relations,
            channelId: ctx.channelId,
            where: { deletedAt: IsNull() },
            ctx,
          }
        )
        .getManyAndCount();
      let variants = await Promise.all(
        items.map(async (item) =>
          this.productPriceApplicator.applyChannelPriceAndTax(
            item,
            ctx,
            undefined,
            false
          )
        )
      );
      variants = variants.map((v) => translateDeep(v, ctx.languageCode));
      allVariants.push(...variants);
      if (allVariants.length >= totalItems) {
        hasMore = false;
      }
      skip += take;
    }
    return allVariants;
  }

  /**
   * Update stock level for a variant based on the given available stock
   */
  private async updateStock(
    ctx: RequestContext,
    variantId: ID,
    availableStock: number
  ) {
    // Find default Stock Location
    const defaultStockLocation =
      await this.stockLocationService.defaultStockLocation(ctx);
    // Get current stock level id
    const { id: stockLevelId } = await this.stockLevelService.getStockLevel(
      ctx,
      variantId,
      defaultStockLocation.id
    );
    // Update stock level
    await this.connection.getRepository(ctx, StockLevel).save({
      id: stockLevelId,
      stockOnHand: availableStock,
      stockAllocated: 0, // Reset allocations, because allocation is handled by QLS
    });
    Logger.info(
      `Updated stock for variant ${variantId} to ${availableStock}`,
      loggerCtx
    );
  }
}
