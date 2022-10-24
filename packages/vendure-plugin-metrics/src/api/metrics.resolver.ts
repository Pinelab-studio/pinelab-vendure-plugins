import { Query, Resolver, Args } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { MetricList, MetricListInput } from '../ui/generated/graphql';
import { MetricsService } from './metrics.service';

@Resolver()
export class MetricsResolver {
  constructor(private service: MetricsService) {}

  @Query()
  //FIXME @Allow(Permission.ReadOrder)
  async metricList(
    @Ctx() ctx: RequestContext,
    @Args('input') input: MetricListInput
  ): Promise<MetricList> {
    return this.service.getMetrics(ctx, input);
  }
}
