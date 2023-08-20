import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import {
  AdvancedMetricSummary,
  AdvancedMetricSummaryInput,
  AdvancedMetricType,
} from '../ui/generated/graphql';

@Resolver()
export class MetricsResolver {
  constructor() {}

  @Query()
  //FIXME @Allow(Permission.ReadOrder)
  async advancedMetricSummaries(
    @Ctx() ctx: RequestContext,
    @Args('input') input: AdvancedMetricSummaryInput
  ): Promise<AdvancedMetricSummary[]> {
    // FIXME this is just mock data
    return [
      {
        code: 'sales-per-product',
        title: 'Nr. of sales per product',
        type: AdvancedMetricType.Number,
        labels: [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ],
        series: [
          {
            name: 'Product 1',
            values: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120],
          },
          {
            name: 'Product 2',
            values: [50, 50, 50, 50, 50, 60, 70, 80, 90, 100, 50, 120],
          },
          {
            name: 'Product 3',
            values: [30, 50, 30, 30, 30, 30, 30, 30, 30, 30, 50, 30],
          },
        ],
      },
      {
        code: 'aov',
        title: 'Average Order Value',
        type: AdvancedMetricType.Currency,
        labels: [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ],
        series: [
          {
            name: 'Average Order Value',
            values: [
              112, 300, 145, 223, 566, 432, 111, 345, 234, 287, 541, 654,
            ],
          },
        ],
      },
    ];
  }
}
