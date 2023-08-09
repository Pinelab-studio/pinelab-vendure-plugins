import { Injector, Order, RequestContext } from '@vendure/core';
import {
  AdvancedMetricSummaryInput,
  AdvancedMetricType,
} from '../../ui/generated/graphql';
import { MetricStrategy } from '../metric-strategy';

/**
 * Calculates the average order value per month
 */
export class AverageOrderValueMetric implements MetricStrategy<Order> {
  readonly metricType: AdvancedMetricType = AdvancedMetricType.Currency;
  readonly code = 'aov';

  getTitle(ctx: RequestContext): string {
    return `Average order value in ${ctx.channel.defaultCurrencyCode}`;
  }

  sortByDateField(): string {
    return 'orderPlacedAt';
  }

  loadData(
    ctx: RequestContext,
    injector: Injector,
    from: Date,
    to: Date,
    input: AdvancedMetricSummaryInput
  ): Promise<Order[]> {
    throw new Error('Method not implemented.');
  }

  calculateDataPoint(
    ctx: RequestContext,
    data: Order[],
    monthNr: number
  ): number[] {
    const total = data
      .map((o) => o.totalWithTax)
      .reduce((total, current) => total + current);
    const average = Math.round(total / data.length) / 100;
    return [average];
  }
}
