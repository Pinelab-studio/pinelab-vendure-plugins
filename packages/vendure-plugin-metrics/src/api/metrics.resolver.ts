import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import {
  AdvancedMetricSummary,
  AdvancedMetricSummaryInput,
  AdvancedMetricType,
} from '../ui/generated/graphql';
import { MetricsService } from './metrics.service';

@Resolver()
export class MetricsResolver {
  constructor(private readonly metricsService: MetricsService) {}

  @Query()
  @Allow(Permission.ReadOrder)
  async advancedMetricSummaries(
    @Ctx() ctx: RequestContext,
    @Args('input') input: AdvancedMetricSummaryInput
  ): Promise<AdvancedMetricSummary[]> {
    return this.metricsService.getMetrics(ctx, input);
  }
}
