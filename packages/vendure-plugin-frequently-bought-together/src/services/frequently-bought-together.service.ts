import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
  ID,
  JobQueue,
  JobQueueService,
  Logger,
  OrderLine,
  ProductVariantService,
  RequestContext,
  SerializedRequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { FPGrowth, Itemset } from 'node-fpgrowth';
import {
  FREQUENTLY_BOUGHT_TOGETHER_PLUGIN_OPTIONS,
  loggerCtx,
} from '../constants';
import { PluginInitOptions } from '../types';
import { FrequentlyBoughtTogetherPreview } from '../generated-graphql-types';

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
    private variantService: ProductVariantService
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
    const initialMemory = process.memoryUsage().heapUsed;
    const itemSets = await this.getItemSets(ctx, support);
    const best = itemSets.slice(-10);
    const worst = itemSets.slice(0, 10);
    const variantIds = [
      ...best.map((i) => i.items).flat(),
      ...worst.map((i) => i.items).flat(),
    ];
    const allVariants = await this.variantService.findByIds(ctx, variantIds);
    // Replace ID's with variant names
    const bestItemSets = best.map((is) => ({
      items: is.items.map(
        (id) => allVariants.find((v) => v.id === id)?.name || String(id)
      ),
      support: is.support,
    }));
    const worstItemSets = worst.map((is) => ({
      items: is.items.map(
        (id) => allVariants.find((v) => v.id === id)?.name || String(id)
      ),
      support: is.support,
    }));
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryUsed = finalMemory - initialMemory;
    return {
      memoryUsed: `${memoryUsed / 1024 / 1024} MB`,
      totalItemSets: itemSets.length,
      bestItemSets,
      worstItemSets,
    };
  }

  private async getItemSets(
    ctx: RequestContext,
    support: number
  ): Promise<Itemset<ID>[]> {
    const result: Array<{ orderId: ID; productVariant_id: ID }> =
      await this.connection
        .getRepository(ctx, OrderLine)
        .createQueryBuilder('orderLine')
        .innerJoin('orderLine.order', 'order')
        .innerJoin('orderLine.productVariant', 'productVariant')
        .innerJoin('order.channels', 'channel')
        .where('order.orderPlacedAt IS NOT NULL')
        .andWhere('channel.id = :channelId', { channelId: ctx.channelId })
        .andWhere('productVariant.deletedAt IS NULL')
        .select(['orderLine.orderId', 'productVariant.id'])
        .orderBy('order.orderPlacedAt', 'DESC')
        .limit(500000)
        .getRawMany();
    // Construct items per order in a map
    const transactions = new Map<ID, ID[]>();
    result.forEach((row) => {
      const transactionsForOrder = transactions.get(row.orderId) || [];
      transactionsForOrder.push(row['productVariant_id']);
      transactions.set(row.orderId, transactionsForOrder);
    });
    const matrix = Array.from(transactions.values());
    const fpgrowth = new FPGrowth<ID>(support);
    const itemSets = (await fpgrowth.exec(matrix))
      // Only combinations allowed
      .filter((is) => is.items.length > 1)
      // Lowest support first, because if they make sense, the higher ones will too
      .sort((a, b) => a.support - b.support);
    const totalUniqueVariants = new Set<ID>();
    itemSets.forEach((itemSet) => {
      itemSet.items.forEach((item) => {
        totalUniqueVariants.add(item);
      });
    });
    Logger.info(
      `Found ${itemSets.length} item sets for ${totalUniqueVariants.size} variants from ${matrix.length} orders and ${result.length} order lines`,
      loggerCtx
    );
    return itemSets;
  }

  /**
   * Create a job to calculate frequently bought together products
   */
  async triggerCalculation(): Promise<void> {}
}
