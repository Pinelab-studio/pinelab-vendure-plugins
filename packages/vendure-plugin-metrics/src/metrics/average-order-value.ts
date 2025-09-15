import { Order, RequestContext } from '@vendure/core';
import { MetricStrategy, NamedDatapoint } from '../services/metric-strategy';
import { AdvancedMetricType } from '../ui/generated/graphql';

/**
 * Calculates the average order value per month
 */
export class AverageOrderValueMetric implements MetricStrategy {
  readonly metricType: AdvancedMetricType = AdvancedMetricType.Currency;
  readonly code = 'aov';
  readonly allowProductSelection = false;

  getTitle(ctx: RequestContext): string {
    return `Average order value`;
  }

  calculateDataPoints(ctx: RequestContext, orders: Order[]): NamedDatapoint[] {
    let averageInclTax = 0;
    let averageExclTax = 0;
    if (orders.length) {
      // Only calculate if there are orders
      let totalWithTax = 0;
      let totalExclTax = 0;
      orders.forEach((o) => {
        totalWithTax += o.totalWithTax;
        totalExclTax += o.total;
      });
      averageInclTax = Math.round(totalWithTax / orders.length) / 100;
      averageExclTax = Math.round(totalExclTax / orders.length) / 100;
    }
    return [
      {
        legendLabel: 'AOV incl. tax',
        value: averageInclTax,
      },
      {
        legendLabel: 'AOV excl. tax',
        value: averageExclTax,
      },
    ];
  }
}
