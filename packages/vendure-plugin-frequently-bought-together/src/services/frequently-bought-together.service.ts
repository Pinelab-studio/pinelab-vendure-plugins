import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
  ID,
  JobQueue,
  JobQueueService,
  Logger,
  OrderLine,
  ProductService,
  RequestContext,
  SerializedRequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { FPGrowth, Itemset } from 'node-fpgrowth';
import {
  FREQUENTLY_BOUGHT_TOGETHER_PLUGIN_OPTIONS,
  loggerCtx,
} from '../constants';
import { FrequentlyBoughtTogetherPreview } from '../generated-graphql-types';
import { PluginInitOptions } from '../types';

@Injectable()
export class FrequentlyBoughtTogetherService implements OnApplicationBootstrap {
  private jobQueue!: JobQueue<{
    ctx: SerializedRequestContext;
    someArg: string;
  }>;

  constructor(
    private connection: TransactionalConnection,
    @Inject(FREQUENTLY_BOUGHT_TOGETHER_PLUGIN_OPTIONS)
    private options: PluginInitOptions,
    private jobQueueService: JobQueueService,
    private productService: ProductService
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'frequently-bought-together-calculation',
      process: async () => {
        // TODO
      },
    });
  }

  async previewItemSets(
    ctx: RequestContext,
    support: number
  ): Promise<FrequentlyBoughtTogetherPreview> {
    const itemSets = await this.getItemSets(ctx, support);
    const best = itemSets.slice(0, 10);
    const worst = itemSets.slice(-10);
    const productIds = [
      ...best.map((i) => i.items).flat(),
      ...worst.map((i) => i.items).flat(),
    ];
    const allProducts = productIds.length
      ? await this.productService.findByIds(ctx, productIds)
      : [];
    // Replace ID's with variant names
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
      totalItemSets: itemSets.length,
      bestItemSets,
      worstItemSets,
    };
  }

  private async getItemSets(
    ctx: RequestContext,
    support: number
  ): Promise<Itemset<ID>[]> {
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
    const matrix = Array.from(transactions.values());
    const fpgrowth = new FPGrowth<ID>(support);
    const itemSets = (await fpgrowth.exec(matrix))
      // Only combinations allowed
      .filter((is) => is.items.length > 1)
      // High to low desc
      .sort((a, b) => b.support - a.support);
    const totalUniqueProducts = new Set<ID>();
    itemSets.forEach((itemSet) => {
      itemSet.items.forEach((item) => {
        totalUniqueProducts.add(item);
      });
    });
    Logger.info(
      `Found ${itemSets.length} item sets for ${totalUniqueProducts.size} variants from ${matrix.length} orders and ${result.length} order lines`,
      loggerCtx
    );
    return itemSets;
  }

  /**
   * Create a job to calculate frequently bought together products
   */
  async triggerCalculation(): Promise<void> {}
}
