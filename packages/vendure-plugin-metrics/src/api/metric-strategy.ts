import {
  AdvancedMetricSummaryInput,
  AdvancedMetricType,
} from '../ui/generated/graphql';
import { RequestContext, Injector, ProductVariant } from '@vendure/core';
/**
 * GroupId is used to group datapoints. For example 'product1', so that the plugin can find all datapoints for that product;
 */
export interface NamedDatapoint {
  legendLabel: string;
  value: number;
}

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
   * Load your entities for the given time frame here.
   * A client can optionally supply variants as input, which means metrics should be shown for the selected variants only
   *
   * Keep performance and object size in mind:
   *
   * Entities are cached in memory, so only return data you actually use in your calculateDataPoint function
   *
   * This function is executed in the main thread when a user views its dashboard,
   * so try not to fetch objects with many relations
   */
  loadEntities(
    ctx: RequestContext,
    injector: Injector,
    from: Date,
    to: Date,
    variants: ProductVariant[]
  ): Promise<T[]>;

  /**
   * Calculate the aggregated datapoint for the given data.
   * E.g. the sum of all given data, or the average.
   *
   * Return multiple datapoints for a multi line chart.
   * The name will be used as legend on the chart.
   *
   * @example
   * // Number of products sold
   * [
   *   {name: 'product1', value: 10 },
   *   {name: 'product2', value: 16 }
   * ]
   */
  calculateDataPoints(
    ctx: RequestContext,
    entities: T[],
    variants: ProductVariant[]
  ): NamedDatapoint[];
}
