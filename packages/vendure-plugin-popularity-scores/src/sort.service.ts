import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ChannelService,
  Collection,
  CollectionService,
  ID,
  JobQueue,
  JobQueueService,
  Logger,
  OrderItem,
  Product,
  RequestContext,
  SerializedRequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { loggerCtx } from './constants';
@Injectable()
export class SortService implements OnModuleInit {
  private jobQueue!: JobQueue<{
    channelToken: string;
    ctx: SerializedRequestContext;
  }>;
  constructor(
    private connection: TransactionalConnection,
    private jobQueueService: JobQueueService,
    private channelService: ChannelService,
    private collectionService: CollectionService
  ) {}
  async onModuleInit() {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'calculate-popularity-scores',
      process: async (job) => {
        await this.setProductPopularity(
          RequestContext.deserialize(job.data.ctx),
          job.data.channelToken
        ).catch((e) => {
          Logger.warn(
            `Failed to handle popularity calculation job: ${e?.message}`,
            loggerCtx
          );
          throw e;
        });
      },
    });
  }

  async setProductPopularity(
    ctx: RequestContext,
    channelToken: string
  ): Promise<void> {
    Logger.info(`Started calculating popularity scores`, loggerCtx);
    const channel = await this.channelService.getChannelFromToken(channelToken);
    const orderItemRepo = this.connection.getRepository(ctx, OrderItem);
    const ordersAfter = new Date();
    ordersAfter.setMonth(ordersAfter.getMonth() - 12);
    const groupedOrderItems = await orderItemRepo
      .createQueryBuilder('orderItem')
      .innerJoin('orderItem.line', 'orderLine')
      .select([
        'count(product.id) as count',
        'orderItem.line',
        'orderLine.productVariant',
        'orderLine.order',
      ])
      .innerJoin('orderLine.productVariant', 'productVariant')
      .addSelect([
        'productVariant.deletedAt',
        'productVariant.enabled',
        'productVariant.id',
      ])
      .innerJoin('orderLine.order', 'order')
      .innerJoin('productVariant.product', 'product')
      .addSelect(['product.deletedAt', 'product.enabled', 'product.id'])
      .leftJoin('productVariant.collections', 'collection')
      .addSelect(['collection.id'])
      .innerJoin('order.channels', 'order_channel')
      .andWhere('order.orderPlacedAt > :ordersAfter', {
        ordersAfter: ordersAfter.toISOString(),
      })
      .andWhere('product.deletedAt IS NULL')
      .andWhere('productVariant.deletedAt IS NULL')
      .andWhere('product.enabled')
      .andWhere('productVariant.enabled')
      .andWhere('order_channel.id = :id', { id: channel.id })
      .addGroupBy('product.id')
      .addOrderBy('count', 'DESC')
      .getRawMany();
    const maxCount = groupedOrderItems?.[0]?.count;
    if (!maxCount) {
      Logger.warn(
        `No orders found for channel ${channel.code}, not calculating popularity scores`,
        loggerCtx
      );
      return;
    }
    const maxValue = 1000;
    const productRepository = this.connection.getRepository(ctx, Product);
    await productRepository.save(
      groupedOrderItems.map((gols) => {
        return {
          id: gols.product_id,
          customFields: {
            popularityScore: Math.round((gols.count / maxCount) * maxValue),
          },
        };
      })
    );
    await this.assignScoreValuesToCollections(ctx);
    Logger.info(`Finished calculating popularity scores`, loggerCtx);
  }
  async assignScoreValuesToCollections(ctx: RequestContext) {
    const allCollectionsScores = await this.getEachCollectionsScore(ctx);
    await this.addUpTheTreeAndSave(allCollectionsScores, ctx);
  }

  /**
   * This calculates the score of a collection based on its products.
   * Does not include scores of subcollections yet
   * @param ctx
   * @returns Array of collection ids and their corresponding popularity scores not including subcollections
   */
  async getEachCollectionsScore(
    ctx: RequestContext
  ): Promise<{ id: string; score: number }[]> {
    const collectionsRepo = this.connection.getRepository(ctx, Collection);
    const productsRepo = this.connection.getRepository(ctx, Product);
    const allCollectionIds = await collectionsRepo
      .createQueryBuilder('collection')
      .innerJoin('collection.channels', 'collection_channel')
      .andWhere('collection_channel.id = :id', { id: ctx.channelId })
      .getRawMany();
    const productScoreSums: { id: string; score: number }[] = [];
    const variantsPartialInfoQuery = collectionsRepo
      .createQueryBuilder('collection')
      .leftJoin('collection.productVariants', 'productVariant')
      .innerJoin('productVariant.product', 'product')
      .addSelect(['product.customFields.popularityScore', 'product.id']);
    const productSummingQuery = productsRepo
      .createQueryBuilder('product')
      .select('SUM(product.customFields.popularityScore) AS productScoreSum');
    for (const col of allCollectionIds) {
      const variantsPartialInfo = await variantsPartialInfoQuery
        .andWhere('collection.id= :id', { id: col.collection_id })
        .getRawMany();

      const productIds = variantsPartialInfo
        .filter((i) => i.product_id != null)
        .map((i) => i.product_id);

      const uniqueProductIds = [...new Set(productIds)];

      const summedProductsValue = await productSummingQuery
        .andWhere('product.id IN (:...ids)', { ids: uniqueProductIds })
        .getRawOne();
      productScoreSums.push({
        id: col.collection_id,
        score: summedProductsValue.productScoreSum,
      });
    }
    await collectionsRepo.save(
      productScoreSums.map((collection) => {
        return {
          id: collection.id,
          customFields: {
            popularityScore: collection.score ?? 0,
          },
        };
      })
    );
    return productScoreSums;
  }

  /**
   *
   * @param input Array of collection ids and their corresponding popularity scores not including subcollections
   * @param ctx The current RequestContext
   */
  async addUpTheTreeAndSave(
    input: { id: string; score: number }[],
    ctx: RequestContext
  ) {
    const collectionsRepo = this.connection.getRepository(ctx, Collection);
    for (const colIndex in input) {
      const desc: number = (
        await this.collectionService.getDescendants(ctx, input[colIndex].id)
      )
        .map((d) => (d.customFields as any).popularityScore)
        .reduce((partialSum: number, a: number) => partialSum + a, 0);
      input[colIndex].score += desc;
    }
    await collectionsRepo.save(
      input.map((collection) => {
        return {
          id: collection.id,
          customFields: {
            popularityScore: collection.score ?? 0,
          },
        };
      })
    );
  }

  addScoreCalculatingJobToQueue(channelToken: string, ctx: RequestContext) {
    return this.jobQueue.add(
      { channelToken, ctx: ctx.serialize() },
      { retries: 5 }
    );
  }
}
