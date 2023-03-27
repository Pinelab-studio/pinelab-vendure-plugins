import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ChannelService,
  CollectionService,
  ID,
  JobQueue,
  JobQueueService,
  OrderItem,
  OrderLine,
  Product,
  RequestContext,
  SerializedRequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { Success } from '../../test/src/generated/admin-graphql';
@Injectable()
export class SortService implements OnModuleInit {
  private jobQueue: JobQueue<{
    channelToken: string;
    ctx: SerializedRequestContext;
  }>;
  constructor(
    private connection: TransactionalConnection,
    private jobQueueService: JobQueueService,
    private channelService: ChannelService
  ) {}
  async onModuleInit() {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'calculate-scores',
      process: async (job) => {
        const channel = await this.channelService.getChannelFromToken(
          job.data.channelToken
        );
        this.setProductPopularity(
          RequestContext.deserialize(job.data.ctx),
          channel.id
        );
      },
    });
  }

  async setProductPopularity(
    ctx: RequestContext,
    channleId: ID
  ): Promise<Success> {
    const groupedOrderItems = await this.connection
      .getRepository(ctx, OrderItem)
      .createQueryBuilder('orderItem')
      .innerJoin('orderItem.line', 'orderLine')
      .select([
        'count(product.id) as count',
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
      .andWhere('order_channel.id = :id', { id: channleId })
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
    return { success: true };
  }

  addScoreCalculatingJobToQueue(channelToken: string, ctx: RequestContext) {
    return this.jobQueue.add(
      { channelToken, ctx: ctx.serialize() },
      { retries: 5 }
    );
  }
}
