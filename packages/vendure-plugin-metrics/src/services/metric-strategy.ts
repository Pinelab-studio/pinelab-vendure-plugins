import {
  AdvancedMetricSummaryInput,
  AdvancedMetricType,
} from '../ui/generated/graphql';
import { RequestContext, ProductVariant, Order } from '@vendure/core';
import { Session } from './request-service';
/**
 * GroupId is used to group datapoints. For example 'product1', so that the plugin can find all datapoints for that product;
 */
export interface NamedDatapoint {
  legendLabel: string;
  value: number;
}

export interface MetricStrategy {
  code: string;
  /**
   * We need to know if the chart should format your metrics as
   *  numbers/amounts or as currency
   */
  metricType: AdvancedMetricType;

  /**
   * Setting to allow a user to select variants for the metrics.
   * For some metrics, like conversion, it doesn't make sense to allow variant selection
   */
  allowProductSelection: boolean;

  /**
   * Title to display on the chart.
   * Ctx can be used to localize the title
   */
  getTitle(ctx: RequestContext): string;

  /**
   * Calculate the aggregated datapoint for the given data.
   * E.g. the sum of all given data, or the average.
   *
   * This functions is called for each month.
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
    orders: Order[],
    sessions: Session[],
    variants: ProductVariant[]
  ): NamedDatapoint[];
}
