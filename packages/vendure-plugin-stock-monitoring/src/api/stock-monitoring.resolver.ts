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
    const variants = await this.connection
      .getRepository(ctx, ProductVariant)
      .find({
        where: {
          stockOnHand: LessThan(StockMonitoringPlugin.threshold),
          enabled: true,
          deletedAt: null,
        },
        relations: ['product'],
        order: {
          stockOnHand: 'ASC',
        },
      });
    return variants.map((variant) =>
      translateEntity(variant, ctx.languageCode)
    );
  }
}
