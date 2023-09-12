import { Query, Resolver } from '@nestjs/graphql';
import {
  Ctx,
  ProductVariant,
  RequestContext,
  TransactionalConnection,
  Permission,
  Allow,
} from '@vendure/core';
import { StockMonitoringPlugin } from '../stock-monitoring.plugin';

@Resolver()
export class StockMonitoringResolver {
  constructor(private connection: TransactionalConnection) {}

  @Query()
  @Allow(Permission.ReadCatalog)
  async productVariantsWithLowStock(
    @Ctx() ctx: RequestContext
  ): Promise<ProductVariant[]> {
    return this.connection
      .getRepository(ctx, ProductVariant)
      .createQueryBuilder('variant')
      .leftJoin('variant.product', 'product')
      .leftJoin('variant.stockLevels', 'stockLevel')
      .addGroupBy('variant.id')
      .addSelect(['SUM(stockLevel.stockOnHand) as stockOnHand'])
      .addSelect(['SUM(stockLevel.stockAllocated) as stockAllocated'])
      .leftJoin('product.channels', 'channel')
      .where('variant.enabled = true')
      .andWhere('stockOnHand - stockAllocated < :threshold', {
        threshold: StockMonitoringPlugin.threshold,
      })
      .andWhere('variant.deletedAt IS NULL')
      .andWhere('channel.id = :channelId', { channelId: ctx.channelId })
      .limit(50)
      .orderBy('stockOnHand', 'ASC')
      .getMany();
  }
}
