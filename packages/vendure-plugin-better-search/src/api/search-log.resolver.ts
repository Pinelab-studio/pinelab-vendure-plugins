import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { SearchLogAggregateListOptions } from './generated/graphql';
import { SearchLogAggregationService } from '../services/search-log-aggregation.service';

/** Exposes retained search analytics to catalog administrators only. */
@Resolver()
export class SearchLogResolver {
  /** Injects the SQL aggregation service. */
  constructor(private aggregation: SearchLogAggregationService) {}

  /** Lists aggregated terms for the active channel using standard Vendure options. */
  @Query()
  @Allow(Permission.ReadCatalog)
  searchLogAggregates(
    @Ctx() ctx: RequestContext,
    @Args('options') options?: SearchLogAggregateListOptions
  ) {
    return this.aggregation.findAll(ctx, options ?? {});
  }
}
