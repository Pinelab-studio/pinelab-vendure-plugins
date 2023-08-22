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
   * Should return the date to sort by. This value is used to determine in what month the datapoint should be displayed.
   * For example `order.orderPlacedAt` when you are doing metrics for Orders.
   * By default `creeatedAt` is used
   */
  getSortableField?(entity: T): Date;

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
   * Calculate the datapoint for the given month. Return multiple datapoints for a multi line chart
   * @example
   * [0, 2, 3]
   */
  calculateDataPoint(
    ctx: RequestContext,
    data: T[],
    monthNr: number,
    input: AdvancedMetricSummaryInput
  ): number[];

  /**
   * Return a list of labels to use as legend when using multi line chart.
   * Should match the number of datapoints returned in calculateDataPoint.
   * Not needed for single line charts
   * @example
   * ['Product A', 'Product B', 'Product C']
   */
  getLegend?(ctx: RequestContext): [string];
}
