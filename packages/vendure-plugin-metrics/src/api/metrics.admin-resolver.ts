import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import type { MetricChart as GraphqlMetricChart } from '../generated/graphql';
import { MetricsService } from '../services/metrics.service';

@Resolver()
export class MetricsAdminResolver {
  constructor(private readonly metricsService: MetricsService) {}

  @Query()
  @Allow(Permission.ReadOrder)
  async metricCharts(
    @Ctx() ctx: RequestContext,
    @Args('code') code: string,
  ): Promise<GraphqlMetricChart[]> {
    const results = await this.metricsService.getCharts(ctx, code);
    return results.map((result) => ({
      code: result.code,
      variation: result.variation,
      title: result.chart.title,
      type: result.chart.type,
      data: result.chart.data,
      options: result.chart.options,
      valueFormat: result.chart.valueFormat ?? 'number',
      updatedAt: result.updatedAt,
    })) as GraphqlMetricChart[];
  }
}
