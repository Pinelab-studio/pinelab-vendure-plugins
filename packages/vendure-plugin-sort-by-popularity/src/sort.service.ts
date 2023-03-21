import { Injectable } from '@nestjs/common';
import {
  OrderLine,
  Product,
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
      .addSelect(['count(product.id) as count'])
      .innerJoinAndSelect('orderLine.productVariant', 'productVariant')
      .innerJoinAndSelect('orderLine.order', '`order`')
      .innerJoinAndSelect('productVariant.product', 'product')
      .innerJoinAndSelect('`order`.channels', 'order_channel')
      .andWhere('`order`.orderPlacedAt is NOT NULL')
      .andWhere('product.deletedAt IS NULL')
      .andWhere('productVariant.deletedAt IS NULL')
      .andWhere('product.enabled')
      .andWhere('productVariant.enabled')
      .andWhere(`order_channel.id=${ctx.channelId}`)
      .addGroupBy('product.id')
      .addOrderBy('count', 'DESC')
      .getRawMany();
    const maxCount = groupedOrderLines[0].count;
    const maxValue = 1000;
    const productRepositoty =
      this.connection.rawConnection.getRepository(Product);
    for (const groupLines of groupedOrderLines) {
      await productRepositoty.update(groupLines.product.id, {
        customFields: {
          popularityScore: (groupLines.count * maxValue) / maxCount,
        },
      });
    }
    return { success: true };
  }

  async assignPopularityToCollections(ctx: RequestContext): Promise<Success> {
    return { success: true };
  }
}
