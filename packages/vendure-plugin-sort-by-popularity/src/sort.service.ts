import { Injectable } from '@nestjs/common';
import {
  OrderLine,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { Success } from '../../test/src/generated/admin-graphql';
@Injectable()
export class SortService {
  constructor(private connection: TransactionalConnection) {}
  async setProductPopularity(ctx: RequestContext): Promise<Success> {
    const groupedOrderLines = await this.connection
      .getRepository(ctx, OrderLine)
      .createQueryBuilder('orderLine')
      // .addSelect(['count(product.id) as count'])
      .innerJoin('orderLine.productVariant', 'productVariant')
      .addSelect([
        'productVariant.deletedAt,productVariant.enabled,productVariant.product',
      ])
      .innerJoin('orderLine.order', 'order')
      .addSelect(['order.orderPlacedAt,order.channels'])
      .innerJoin('productVariant.product', 'product')
      .addSelect([
        'product.deletedAt,product.enabled,product.id,count(product.id) as count',
      ])
      // .leftJoin('order.channels','order_channel',)
      // .andWhere(`
      //     order.orderPlacedAt is NOT NULL
      // `)
      .andWhere('product.deletedAt IS NULL')
      .andWhere('productVariant.deletedAt IS NULL')
      .andWhere('product.enabled')
      .andWhere('productVariant.enabled')
      // .andWhere(`order_channel.id=${ctx.channelId}`)
      .addGroupBy('product.id')
      .addOrderBy('count', 'DESC')
      .getRawMany();
    console.log(groupedOrderLines);
    return { success: true };
  }

  async assignPopularityToCollections(ctx: RequestContext): Promise<Success> {
    return { success: true };
  }
}
