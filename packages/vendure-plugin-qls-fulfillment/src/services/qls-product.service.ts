import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import {
  ID,
  Job,
  JobQueue,
  JobQueueService,
  Logger,
  ProductVariant,
  ProductVariantService,
  RequestContext,
  RequestContextService,
  StockLevel,
  StockLevelService,
  StockLocationService,
  TransactionalConnection,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import util from 'util';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { getQlsClient } from '../lib/qls-client';
import { QlsPluginOptions, QlsProductJobData } from '../types';
import { QlsFulfillmentStock } from '../lib/types';

function wait(delay: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve('');
    }, delay);
  });
}

type SyncProductsJobResult = {
  updatedInQls: number;
  createdInQls: number;
  updateStock: number;
};

@Injectable()
export class QlsProductService implements OnModuleInit, OnApplicationBootstrap {
  private productJobQueue!: JobQueue<QlsProductJobData>;

  constructor(
    private connection: TransactionalConnection,
    @Inject(PLUGIN_INIT_OPTIONS) private options: QlsPluginOptions,
    private jobQueueService: JobQueueService,
    private stockLevelService: StockLevelService,
    private readonly requestContextService: RequestContextService,
    private readonly variantService: ProductVariantService,
    private readonly stockLocationService: StockLocationService
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // TODO listen for ProductVariantEvent and add a job to the queue

    // FIXME
    const ctx = await this.requestContextService.create({
      apiType: 'admin',
    });
    await this.triggerFullSyncProducts(ctx);
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
        return await this.syncAllProducts(ctx);
      } else if (job.data.action === 'sync-products') {
        return await this.syncProducts(ctx, job.data.productVariantIds);
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
  async syncAllProducts(ctx: RequestContext): Promise<SyncProductsJobResult> {
    Logger.debug('Full product sync to QLS');

    let processedCount = 0;
    try {
      const client = await getQlsClient(ctx, this.options);
      if (!client) {
        throw new Error(`QLS not enabled for channel ${ctx.channel.token}`);
      }

      const allQlsProducts = await client.getAllFulfillmentStocks();
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
          await this.updateStock(ctx, variant.id, qlsProduct.amount_total);
          updateStockCount += 1;
        }
      }
      Logger.info(
        `Updated stock for ${updateStockCount} variants based on QLS stock levels`,
        loggerCtx
      );
      // Create products in QLS
      let createdQlsProductsCount = 0;
      for (const variant of allVariants) {
        const existingQlsProduct = allQlsProducts.find(
          (p) => p.sku == variant.sku
        );
        if (existingQlsProduct) {
          continue; // Already exists in QLS
        }
        await client.createFulfillmentProduct({
          name: variant.name,
          sku: variant.sku,
          ...this.options.getAdditionalVariantFields?.(ctx, variant),
        });
        createdQlsProductsCount += 1;
      }
      Logger.info(
        `Created ${createdQlsProductsCount} products in QLS`,
        loggerCtx
      );
      // Update products in QLS
      let updatedQlsProductsCount = 0;
      for (const variant of allVariants) {
        const existingProduct = allQlsProducts.find(
          (p) => p.sku == variant.sku
        );
        if (!this.shouldUpdateProductInQls(ctx, variant, existingProduct)) {
          continue;
        }
        await client.updateFulfillmentProduct(existingProduct!.id, {
          sku: variant.sku,
          name: variant.name,
          ...this.options.getAdditionalVariantFields?.(ctx, variant),
        });
        updatedQlsProductsCount += 1;
      }
      return {
        updatedInQls: updatedQlsProductsCount,
        createdInQls: createdQlsProductsCount,
        updateStock: updateStockCount,
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
   * Determine if a product needs to be updated in QLS.
   * Only returns true if the product needs to be updated, not created!
   */
  private shouldUpdateProductInQls(
    ctx: RequestContext,
    variant: ProductVariant,
    qlsProduct?: QlsFulfillmentStock
  ): boolean {
    if (!qlsProduct) {
      // If no QLS product exists, return false, because it needs creation, not update
      return true;
    }
    const additionalFields = this.options.getAdditionalVariantFields?.(
      ctx,
      variant
    );
    if (
      qlsProduct.name !== variant.name ||
      qlsProduct.ean !== additionalFields?.ean
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
      const result = await this.variantService.findAll(ctx, {
        filter: { deletedAt: { isNull: true } },
        skip,
        take,
      });
      if (!result.items.length) {
        break;
      }
      allVariants.push(...result.items);
      if (allVariants.length >= result.totalItems) {
        hasMore = false;
      }
      skip += take;
    }
    return allVariants;
  }

  /**
   * Sync particular product variants to QLS
   */
  async syncProducts(
    ctx: RequestContext,
    productVariantIds: ID[]
  ): Promise<SyncProductsJobResult> {
    // try {
    //   const client = await getQlsClient(ctx, this.options);
    //   if (!client) {
    //     throw new Error(`QLS not enabled for channel ${ctx.channel.token}`);
    //   }

    //   const productVariantRepository = this.connection.getRepository(
    //     ctx,
    //     ProductVariant
    //   );

    //   const productVariants = await productVariantRepository.find({
    //     where: {
    //       id: In(productVariantIds),
    //     },
    //   });

    //   for (const productVariant of productVariants) {
    //     const fulfillmentProductId =
    //       productVariant.customFields?.qlsFulfillmentProductId;
    //     if (fulfillmentProductId) {
    //       const response = await client.updateFulfillmentProduct(
    //         fulfillmentProductId,
    //         {
    //           // name: productVariant.name, // TODO updating the name seems to be not supported
    //           ...this.mapProductVariantToFulfillmentProductAttributes(
    //             productVariant
    //           ),
    //         }
    //       );
    //       updatedFullfillmentProducts.push({
    //         productVariantId: productVariant.id,
    //         qlsFulfillmentProductId: response.id,
    //       });
    //     } else {
    //       // NOTE: This case should actually never happen, because fulfillment products are created on the fly when product variants are created.
    //       const response = await client.createFulfillmentProduct({
    //         name: productVariant.name, // FIXME name is not resolved for languageCode
    //         ...this.mapProductVariantToFulfillmentProductAttributes(
    //           productVariant
    //         ),
    //       });
    //       await this.saveQlsProductId(productVariant, response.id);
    //       createdFullfillmentProducts.push({
    //         productVariantId: productVariant.id,
    //         qlsFulfillmentProductId: response.id,
    //       });
    //     }

    //     await wait(100);
    //   }
    // } catch (error) {
    //   Logger.error(
    //     `Error while updating fulfillment products in QLS: ${
    //       (error as Error).message
    //     }`,
    //     loggerCtx
    //   );
    // }

    return {
      updatedInQls: 0,
      createdInQls: 0,
      updateStock: 0, // FIXME
    };
  }

  /**
   * Trigger a full product sync job
   */
  async triggerFullSyncProducts(ctx: RequestContext) {
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
  async triggerSyncProducts(ctx: RequestContext, productVariantIds: ID[]) {
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
