import {
  AdvancedMetricInterval,
  AdvancedMetricSummaryEntry,
  AdvancedMetricSummaryInput,
  AdvancedMetricType,
} from '../ui/generated/graphql';
import { RequestContext, Injector } from '@vendure/core';

type DataWithCreatedAt = { createdAt: Date };

export interface MetricStrategy<T extends DataWithCreatedAt[]> {
  code: string;
  /**
   * We need to know if the chart should format your metrics as
   *  numbers/amounts or as currency
   */
  metricType: AdvancedMetricType;

  /**
   * Title to display on the chart.
   * Ctx can be used to localize the title
   */
  getTitle(ctx: RequestContext): string;

  /**
   * Load your data for the given time frame here.
   *
   * Keep performance and object size in mind:
   *
   * Data is cached in memory, so only return data you actually use in your calculateDataPoint function
   *
   * This function is executed in the main thread when a user views its dashboard,
   * so try not to fetch objects with many relations
   */
  loadData(
    ctx: RequestContext,
    injector: Injector,
    from: Date,
    to: Date,
    input: AdvancedMetricSummaryInput
  ): Promise<T>;

  /**
   * Calculate the datapoint for the given month. Return multiple datapoints for a stacked line chart
   *
   * @param ctx
   * @param data The data for the current timeframe
   */
  calculateDataPoint(
    ctx: RequestContext,
    data: T,
    monthNr: number,
    input: AdvancedMetricSummaryInput
  ): number[];
}

// FIXME Sample strategy for Stripe subscription. Remove later
type StripePayment = { amount: number; createdAt: Date };

export class StripeSubscriptionMetric
  implements MetricStrategy<StripePayment[]>
{
  code = 'stripe-subscription-payment';
  metricType = AdvancedMetricType.Currency;

  getTitle(ctx: RequestContext): string {
    return `Received payments`;
  }

  async loadData(
    ctx: RequestContext,
    injector: Injector,
    from: Date,
    to: Date,
    input: AdvancedMetricSummaryInput
  ): Promise<StripePayment[]> {
    // Load payments between `from` and `to`. Optionally you can use `input.variantIds` in your query
    return [
      {
        amount: 123,
        createdAt: new Date(),
      },
    ];
  }

  calculateDataPoint(ctx: RequestContext, data: StripePayment[]): number[] {
    // Calculate the sum of all payments for this month
    return [data.reduce((acc, curr) => acc + curr.amount, 0)];
  }
}
