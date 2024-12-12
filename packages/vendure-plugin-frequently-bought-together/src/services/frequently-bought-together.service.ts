/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
  EntityHydrator,
  ID,
  JobQueue,
  JobQueueService,
  Logger,
  OrderLine,
  Product,
  ProductService,
  RequestContext,
  SerializedRequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import { FPGrowth } from 'node-fpgrowth';
import {
  FREQUENTLY_BOUGHT_TOGETHER_PLUGIN_OPTIONS,
  loggerCtx,
} from '../constants';
import { FrequentlyBoughtTogetherPreview } from '../generated-graphql-types';
import {
  FrequentlyBoughtTogetherCalculationResult,
  PluginInitOptions,
  Support,
} from '../types';
import { getRelatedProductsPerProduct } from './util';

@Injectable()
export class FrequentlyBoughtTogetherService implements OnApplicationBootstrap {
  private jobQueue!: JobQueue<{
    ctx: SerializedRequestContext;
  }>;

  constructor(
    private connection: TransactionalConnection,
    @Inject(FREQUENTLY_BOUGHT_TOGETHER_PLUGIN_OPTIONS)
    private options: PluginInitOptions,
    private jobQueueService: JobQueueService,
    private productService: ProductService,
    private entityHydrator: EntityHydrator
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'frequently-bought-together-calculation',
      process: async (job) =>
        this.createFrequentlyBoughtTogetherRelations(
          RequestContext.deserialize(job.data.ctx)
        ).catch((e) => {
          Logger.error(
            `Failed to calculate frequently bought together relations: ${
              asError(e).message
            }`,
            loggerCtx
          );
          throw e;
        }),
    });
  }

  /**
   * Calculate frequently bought together relations and set on the products
   */
  async createFrequentlyBoughtTogetherRelations(
    ctx: RequestContext
  ): Promise<number> {
    const support =
      typeof this.options.supportLevel === 'function'
        ? this.options.supportLevel(ctx)
        : this.options.supportLevel;
    const { itemSets, uniqueProducts } = await this.getItemSets(ctx, support);
    const relatedProductsPerProduct = getRelatedProductsPerProduct(
      itemSets,
      this.options.maxRelatedProducts
    );
    for (const [
      productId,
      supportPerProduct,
    ] of relatedProductsPerProduct.entries()) {
      await this.connection.getRepository(ctx, Product).save({
        id: productId,
        customFields: {
          frequentlyBoughtWith: supportPerProduct.map((s) => ({
            id: s.productId,
          })),
          frequentlyBoughtWithSupport: JSON.stringify(supportPerProduct),
        },
      });
      Logger.debug(
        `Set frequently bought together products for '${productId}' to [${supportPerProduct
          .map((s) => s.productId)
          .join(',')}]`,
        loggerCtx
      );
    }
    Logger.info(
      `Set frequently bought together relations for ${relatedProductsPerProduct.size} products`,
      loggerCtx
    );
    return uniqueProducts;
  }

  async previewItemSets(
    ctx: RequestContext,
    support: number
  ): Promise<FrequentlyBoughtTogetherPreview> {
    const { itemSets, maxMemoryUsedInMB, uniqueProducts } =
      await this.getItemSets(ctx, support);
    const best = itemSets.slice(0, 10);
    const worst = itemSets.slice(-10);
    const bestAndWorstProductIds = [
      ...best.map((i) => i.items).flat(),
      ...worst.map((i) => i.items).flat(),
    ];
    const allProducts = bestAndWorstProductIds.length
      ? await this.productService.findByIds(ctx, bestAndWorstProductIds)
      : [];
    // Replace ID's with product names
    const bestItemSets = best.map((is) => ({
      items: is.items.map(
        (id) => allProducts.find((v) => v.id === id)?.name || String(id)
      ),
      support: is.support,
    }));
    const worstItemSets = worst.map((is) => ({
      items: is.items.map(
        (id) => allProducts.find((v) => v.id === id)?.name || String(id)
      ),
      support: is.support,
    }));
    return {
      maxMemoryUsedInMB,
      uniqueProducts,
      totalItemSets: itemSets.length,
      bestItemSets,
      worstItemSets,
    };
  }

  /**
   * Sort the related products by their support level,
   * so that the most frequently bought together products are first
   */
  async getSortedProducts(
    ctx: RequestContext,
    product: Product
  ): Promise<Product[]> {
    await this.entityHydrator.hydrate(ctx, product, {
      relations: ['customFields.frequentlyBoughtWith'],
    });
    if (!product.customFields.frequentlyBoughtWith) {
      return [];
    }
    const supportPerProduct: Partial<Support>[] = JSON.parse(
      product.customFields.frequentlyBoughtWithSupport || '[]'
    );
    if (!Array.isArray(supportPerProduct)) {
      Logger.error(
        `product.customFields.frequentlyBoughtWithSupport for product '${product.id}' is not an array`,
        loggerCtx
      );
      return [];
    }
    return product.customFields.frequentlyBoughtWith?.sort((a, b) => {
      const supportA =
        supportPerProduct.find((s) => s.productId === a.id)?.support || 0;
      const supportB =
        supportPerProduct.find((s) => s.productId === b.id)?.support || 0;
      return supportB - supportA;
    });
  }

  private async getItemSets(
    ctx: RequestContext,
    support: number
  ): Promise<FrequentlyBoughtTogetherCalculationResult> {
    const rss = [0];
    rss.push(process.memoryUsage().rss);
    const result: Array<{ orderId: ID; productVariant_productId: ID }> =
      await this.connection
        .getRepository(ctx, OrderLine)
        .createQueryBuilder('orderLine')
        .innerJoin('orderLine.order', 'order')
        .innerJoin('orderLine.productVariant', 'productVariant')
        .innerJoin('order.channels', 'channel')
        .where('order.orderPlacedAt IS NOT NULL')
        .andWhere('channel.id = :channelId', { channelId: ctx.channelId })
        .andWhere('productVariant.deletedAt IS NULL')
        .select(['orderLine.orderId', 'productVariant.productId'])
        .orderBy('order.orderPlacedAt', 'DESC')
        .limit(500000)
        .getRawMany();
    rss.push(process.memoryUsage().rss);
    // Construct items per order in a map
    const transactions = new Map<ID, ID[]>();
    result.forEach((row) => {
      const transactionsForOrder = transactions.get(row.orderId) || [];
      const productId = row['productVariant_productId'];
      if (!transactionsForOrder.includes(productId)) {
        // Only add if productID is not already in the list
        transactionsForOrder.push(productId);
        transactions.set(row.orderId, transactionsForOrder);
      }
    });
    rss.push(process.memoryUsage().rss);
    const matrix = Array.from(transactions.values());
    rss.push(process.memoryUsage().rss);
    const fpgrowth = new FPGrowth<ID>(support);
    rss.push(process.memoryUsage().rss);
    const itemSets = (await fpgrowth.exec(matrix))
      // Only combinations allowed
      .filter((is) => is.items.length > 1)
      // High to low desc
      .sort((a, b) => b.support - a.support);
    rss.push(process.memoryUsage().rss);
    const totalUniqueProducts = new Set<ID>();
    itemSets.forEach((itemSet) => {
      itemSet.items.forEach((item) => {
        totalUniqueProducts.add(item);
      });
    });
    rss.push(process.memoryUsage().rss);
    const maxMemoryUsedInMB = Math.round(Math.max(...rss) / 1024 / 1024);
    Logger.info(
      `Found ${itemSets.length} item sets for ${totalUniqueProducts.size} products from ${matrix.length} orders and ${result.length} order lines. Max memory used: ${maxMemoryUsedInMB}MB`,
      loggerCtx
    );
    return {
      itemSets,
      maxMemoryUsedInMB,
      uniqueProducts: totalUniqueProducts.size,
    };
  }

  /**
   * Create a job to calculate frequently bought together products
   */
  async triggerCalculation(ctx: RequestContext): Promise<boolean> {
    await this.jobQueue.add({ ctx: ctx.serialize() }, { retries: 5 });
    return true;
  }
}
