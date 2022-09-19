import { Query, Resolver } from '@nestjs/graphql';
import {
  Ctx,
  ProductVariant,
  RequestContext,
  TransactionalConnection,
  translateEntity,
  Permission,
  Allow,
} from '@vendure/core';
import { LessThan } from 'typeorm';
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
      .leftJoin('product.channels', 'channel')
      .where('variant.enabled = true')
      .andWhere('variant.stockOnHand < :threshold', {
        threshold: StockMonitoringPlugin.threshold,
      })
      .andWhere('variant.deletedAt IS NULL')
      .andWhere('channel.id = :channelId', { channelId: ctx.channelId })
      .limit(50)
      .orderBy('variant.stockOnHand', 'ASC')
      .getMany();
  }
}
