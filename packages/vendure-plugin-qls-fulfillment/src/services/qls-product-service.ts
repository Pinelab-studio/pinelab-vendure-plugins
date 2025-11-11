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
  RequestContext,
  StockLevelService,
  TransactionalConnection,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import { In } from 'typeorm';
import util from 'util';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { getQlsClient } from '../lib/qls-client';
import {
  QlsFulfilllmentProductSyncedAttributes,
  QlsFulfillmentProduct,
  QlsPluginOptions,
  QlsProductJobData,
} from '../types';

function wait(delay: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve('');
    }, delay);
  });
}

@Injectable()
export class QlsProductService implements OnModuleInit, OnApplicationBootstrap {
  private productJobQueue!: JobQueue<QlsProductJobData>;

  constructor(
    private connection: TransactionalConnection,
    @Inject(PLUGIN_INIT_OPTIONS) private options: QlsPluginOptions,
    private jobQueueService: JobQueueService,
    private stockLevelService: StockLevelService
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // TODO listen for ProductVariantEvent and add a job to the queue
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
      if (job.data.action === 'sync-products') {
        return await this.syncFulfillmentProducts(ctx);
      } else if (job.data.action === 'create-products') {
        return await this.createFulfillmentProducts(
          ctx,
          job.data.productVariantIds
        );
      } else if (job.data.action === 'update-products') {
        return await this.updateFulfillmentProducts(
          ctx,
          job.data.productVariantIds
        );
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
   */
  async syncFulfillmentProducts(
    ctx: RequestContext
  ): Promise<{ count: number }> {
    Logger.debug('Full product sync to QLS');

    let processedCount = 0;
    try {
      const client = await getQlsClient(ctx, this.options);
      if (!client) {
        throw new Error(`QLS not enabled for channel ${ctx.channel.token}`);
      }

      const productVariantRepository = this.connection.getRepository(
        ctx,
        ProductVariant
      );

      const productVariantsCount = await productVariantRepository.count();

      const batchSize = 10; // TODO make batch size configurable
      const batchDelay = 10000; // TODO make batch delay configurable

      const batches = Math.ceil(productVariantsCount / batchSize);

      for (let i = 1; i <= batches; i++) {
        Logger.debug(`running batch ${i} of ${batches}`);
        const productVariants = await productVariantRepository.find({
          skip: (i - 1) * batchSize,
          take: batchSize,
        });
        for (const productVariant of productVariants) {
          const response = await client.createFulfillmentProduct({
            name: productVariant.name, // FIXME name is not resolved for languageCode
            ...this.mapProductVariantToFulfillmentProductAttributes(
              productVariant
            ),
          });
          await this.saveQlsProductId(productVariant, response.id);
          await wait(100);
          processedCount += 1;
        }
        await wait(batchDelay);
      }
    } catch (error) {
      Logger.error(
        `Error while syncing fulfillment products to QLS: ${
          (error as Error).message
        }`,
        loggerCtx
      );
    }
    return { count: processedCount };
  }

  private mapProductVariantToFulfillmentProductAttributes(
    productVariant: ProductVariant
  ): QlsFulfilllmentProductSyncedAttributes {
    return {
      sku: productVariant.sku,
      image_url: productVariant.featuredAsset?.preview,
      // TODO add more attributes?
    };
  }

  /**
   * Create fulfillment products in QLS
   */
  async createFulfillmentProducts(
    ctx: RequestContext,
    productVariantIds: ID[]
  ): Promise<{ productVariantId: ID; qlsFulfillmentProductId: string }[]> {
    Logger.debug('Full product sync to QLS');

    const createdFullfillmentProducts: {
      productVariantId: ID;
      qlsFulfillmentProductId: string;
    }[] = [];

    try {
      const client = await getQlsClient(ctx, this.options);
      if (!client) {
        throw new Error(`QLS not enabled for channel ${ctx.channel.token}`);
      }

      const productVariantRepository = this.connection.getRepository(
        ctx,
        ProductVariant
      );

      const productVariants = await productVariantRepository.find({
        where: {
          id: In(productVariantIds),
        },
      });

      for (const productVariant of productVariants) {
        const response = await client.createFulfillmentProduct({
          name: productVariant.name, // FIXME name is not resolved for languageCode
          ...this.mapProductVariantToFulfillmentProductAttributes(
            productVariant
          ),
        });
        await this.saveQlsProductId(productVariant, response.id);
        await wait(100);
        createdFullfillmentProducts.push({
          productVariantId: productVariant.id,
          qlsFulfillmentProductId: response.id,
        });
      }
    } catch (error) {
      Logger.error(
        `Error while creating fulfillment products in QLS: ${
          (error as Error).message
        }`,
        loggerCtx
      );
    }
    return createdFullfillmentProducts;
  }

  /**
   * // TODO Save the SQL product id for a product variant
   */
  private async saveQlsProductId(productVariant: ProductVariant, id: string) {
    // productVariant.customFields?.qlsFulfillmentProductId = response.id;
    // await productVariantRepository.save(productVariant);
  }

  async updateFulfillmentProducts(
    ctx: RequestContext,
    productVariantIds: ID[]
  ): Promise<{
    updated: { productVariantId: ID; qlsFulfillmentProductId: string }[];
    created: { productVariantId: ID; qlsFulfillmentProductId: string }[];
  }> {
    const updatedFullfillmentProducts: {
      productVariantId: ID;
      qlsFulfillmentProductId: string;
    }[] = [];

    const createdFullfillmentProducts: {
      productVariantId: ID;
      qlsFulfillmentProductId: string;
    }[] = [];

    try {
      const client = await getQlsClient(ctx, this.options);
      if (!client) {
        throw new Error(`QLS not enabled for channel ${ctx.channel.token}`);
      }

      const productVariantRepository = this.connection.getRepository(
        ctx,
        ProductVariant
      );

      const productVariants = await productVariantRepository.find({
        where: {
          id: In(productVariantIds),
        },
      });

      for (const productVariant of productVariants) {
        if (productVariant.customFields?.qlsFulfillmentProductId) {
          const response = await client.updateFulfillmentProduct({
            // name: productVariant.name, // TODO updating the name is not supported
            ...this.mapProductVariantToFulfillmentProductAttributes(
              productVariant
            ),
          });
          updatedFullfillmentProducts.push({
            productVariantId: productVariant.id,
            qlsFulfillmentProductId: response.id,
          });
        } else {
          // NOTE: This case should actually never happen, because fulfillment products are created on the fly when product variants are created.
          const response = await client.createFulfillmentProduct({
            name: productVariant.name, // FIXME name is not resolved for languageCode
            ...this.mapProductVariantToFulfillmentProductAttributes(
              productVariant
            ),
          });
          await this.saveQlsProductId(productVariant, response.id);
          createdFullfillmentProducts.push({
            productVariantId: productVariant.id,
            qlsFulfillmentProductId: response.id,
          });
        }

        await wait(100);
      }
    } catch (error) {
      Logger.error(
        `Error while updating fulfillment products in QLS: ${
          (error as Error).message
        }`,
        loggerCtx
      );
    }

    return {
      updated: updatedFullfillmentProducts,
      created: createdFullfillmentProducts,
    };
  }

  async triggerSyncProducts(ctx: RequestContext) {
    return this.productJobQueue.add({
      action: 'sync-products',
      ctx: ctx.serialize(),
    });
  }

  async triggerCreateFulfillmentProducts(
    ctx: RequestContext,
    productVariantIds: ID[]
  ) {
    return this.productJobQueue.add({
      action: 'create-products',
      ctx: ctx.serialize(),
      productVariantIds,
    });
  }

  async triggerUpdateFulfillmentProducts(
    ctx: RequestContext,
    productVariantIds: ID[]
  ) {
    return this.productJobQueue.add({
      action: 'update-products',
      ctx: ctx.serialize(),
      productVariantIds,
    });
  }

  async updateStock(
    ctx: RequestContext,
    fulfillmentProduct: QlsFulfillmentProduct
  ) {
    Logger.debug(`update stock for QLS product "${fulfillmentProduct.id}"`);
    const productVariantRepository = this.connection.getRepository(
      ctx,
      ProductVariant
    );

    const productVariant = await productVariantRepository.findOne({
      where: {
        sku: fulfillmentProduct.sku,
      },
    });

    if (!productVariant) {
      Logger.error(
        `Tried to update stock for a product variant with sku "${fulfillmentProduct.sku}" which doesn't exist`,
        loggerCtx
      );
    }

    for (const warehouseStock of fulfillmentProduct.warehouse_stocks) {
      const stockLocationId = warehouseStock.id; // TODO
      await this.stockLevelService.updateStockOnHandForLocation(
        ctx,
        productVariant!.id,
        stockLocationId,
        warehouseStock.amount_current || 0
      );
    }
  }
}
