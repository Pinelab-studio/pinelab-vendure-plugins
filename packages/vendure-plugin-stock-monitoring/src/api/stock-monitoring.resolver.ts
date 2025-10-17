import { Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  Permission,
  ProductVariant,
  RequestContext,
} from '@vendure/core';
import { StockMonitoringService } from '../services/stock-monitoring.service';

@Resolver()
export class StockMonitoringResolver {
  constructor(private stockMonitoringService: StockMonitoringService) {}

  @Query()
  @Allow(Permission.ReadCatalog)
  async productVariantsWithLowStock(
    @Ctx() ctx: RequestContext
  ): Promise<ProductVariant[]> {
    return this.stockMonitoringService.getVariantsBelowThreshold(ctx);
  }
}
