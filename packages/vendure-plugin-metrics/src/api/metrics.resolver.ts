import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { MetricsService } from './metrics.service';
import {
  AdvancedMetricSummary,
  AdvancedMetricSummaryInput,
} from '../ui/generated/graphql';

@Resolver()
export class MetricsResolver {
  constructor(private service: MetricsService) {}

  @Query()
  @Allow(Permission.ReadOrder)
  async advancedMetricSummary(
    @Ctx() ctx: RequestContext,
    @Args('input') input: AdvancedMetricSummaryInput
  ): Promise<AdvancedMetricSummary[]> {
    return this.service.getMetrics(ctx, input);
  }
}
