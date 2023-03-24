import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ChannelService,
  Collection,
  CollectionService,
  JobQueue,
  JobQueueService,
  OrderItem,
  Product,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { Success } from '../../test/src/generated/admin-graphql';
@Injectable()
export class SortService implements OnModuleInit {
  private jobQueue: JobQueue<{ channelToken: string }>;
  constructor(
    private connection: TransactionalConnection,
    private jobQueueService: JobQueueService,
    private channelService: ChannelService,
    private collectionService: CollectionService
  ) {}
  async onModuleInit() {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'calculate-scores',
      process: async (job) => {
        const channel = await this.channelService.getChannelFromToken(
          job.data.channelToken
        );
        const ctx = new RequestContext({
          apiType: 'admin',
          isAuthorized: true,
          authorizedAsOwnerOnly: false,
          channel,
        });
        this.setProductPopularity(ctx);
      },
    });
  }

  async setProductPopularity(ctx: RequestContext): Promise<Success> {
    const groupedOrderItems = await this.connection
      .getRepository(ctx, OrderItem)
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
      .innerJoin('productVariant.collections', 'collection')
      .addSelect(['collection.id'])
      .innerJoin('order.channels', 'order_channel')
      .andWhere('order.orderPlacedAt is NOT NULL')
      .andWhere('product.deletedAt IS NULL')
      .andWhere('productVariant.deletedAt IS NULL')
      .andWhere('product.enabled')
      .andWhere('productVariant.enabled')
      .andWhere('order_channel.id = :id', { id: ctx.channelId })
      .addGroupBy('product.id')
      .addOrderBy('count', 'DESC')
      .getRawMany();
    const maxCount = groupedOrderItems[0].count;
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
    return { success: true };
  }

  async assignScoreValuesToCollections(ctx: RequestContext) {
    const allCollections = await this.saveEachCollectionScore(ctx);
    await this.addUpTheTreeAndSave(allCollections, ctx);
  }

  async saveEachCollectionScore(ctx: RequestContext): Promise<any[]> {
    const collectionsRepo = this.connection.getRepository(ctx, Collection);
    const allCollections = await collectionsRepo
      .createQueryBuilder('collection')
      .leftJoin('collection.productVariants', 'productVariant')
      .addGroupBy('productVariant.productId')
      .addSelect(['productVariant.product'])
      .leftJoin('productVariant.product', 'product')
      .addSelect(['SUM(distinct product.customFieldsPopularityscore) as score'])
      .addGroupBy('collection.id')
      .orderBy('collection.isRoot', 'ASC')
      .addOrderBy('collection.parentId', 'ASC')
      .addOrderBy('collection.position', 'DESC')
      .getRawMany();
    await collectionsRepo.save(
      allCollections.map((collection) => {
        return {
          id: collection.collection_id,
          customFields: {
            popularityScore: collection.score ?? 0,
          },
        };
      })
    );
    return allCollections;
  }

  async addUpTheTreeAndSave(input: any[], ctx: RequestContext) {
    const collectionsRepo = this.connection.getRepository(ctx, Collection);
    for (const col of input) {
      const desc: number = (
        await this.collectionService.getDescendants(ctx, col.collection_id)
      )
        .map((d) => (d.customFields as any).popularityScore)
        .reduce((partialSum: number, a: number) => partialSum + a, 0);
      await collectionsRepo.save({
        id: col.collection_id,
        customFields: {
          popularityScore: col.score ?? 0 + desc ?? 0,
        },
      });
    }
  }

  addScoreCalculatingJobToQueue(channelToken: string) {
    return this.jobQueue.add({ channelToken }, { retries: 5 });
  }
}
