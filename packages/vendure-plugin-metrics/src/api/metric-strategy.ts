import {
  AdvancedMetricSummaryInput,
  AdvancedMetricType,
} from '../ui/generated/graphql';
import { RequestContext, Injector } from '@vendure/core';

export interface MetricStrategy<T> {
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
   * Should return the field to sort and order when loading data.
   * For example `orderPlacedAt` when you are doing metrics for Orders
   * Has to be a Date
   */
  sortByDateField(): string;

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
  ): Promise<T[]>;

  /**
   * Calculate the datapoint for the given month. Return multiple datapoints for a stacked line chart
   *
   * @param ctx
   * @param data The data for the current timeframe
   */
  calculateDataPoint(
    ctx: RequestContext,
    data: T[],
    monthNr: number,
    input: AdvancedMetricSummaryInput
  ): number[];
}
