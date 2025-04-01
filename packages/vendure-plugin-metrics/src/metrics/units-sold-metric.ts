import {
  Injector,
  Logger,
  Order,
  OrderLine,
  ProductVariant,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { AdvancedMetricType } from '../ui/generated/graphql';
import { MetricStrategy, NamedDatapoint } from '../services/metric-strategy';
import { loggerCtx } from '../constants';
import { Visit } from '../services/request-service';

/**
 * Calculates the number of products sold per month.
 * calculates the sum of all items in an order if no variantIds are provided
 */
export class UnitsSoldMetric implements MetricStrategy {
  readonly metricType: AdvancedMetricType = AdvancedMetricType.Number;
  readonly code = 'units-sold';
  readonly allowProductSelection = true;

  getTitle(ctx: RequestContext): string {
    return `Units sold`;
  }

  calculateDataPoints(
    ctx: RequestContext,
    orders: Order[],
    visits: Visit[],
    variants: ProductVariant[]
  ): NamedDatapoint[] {
    const lines = orders.map((order) => order.lines).flat();
    // Return the nr of products sold
    if (!variants.length) {
      // Return total sum of quantities if no variantIds given
      const total = lines
        .map((line) => line.quantity)
        .reduce((total, current) => total + current, 0);
      return [
        {
          legendLabel: 'Total of all variants',
          value: total,
        },
      ];
    }
    // Else calculate sum per variant
    const dataPoints: NamedDatapoint[] = [];
    variants.forEach((variant) => {
      // Find order lines per variant id
      const linesForVariant = lines.filter(
        (line) => line.productVariant.id === variant.id
      );
      // Sum of quantities for this variant
      const sum = linesForVariant.reduce(
        (total, current) => total + current.quantity,
        0
      );
      dataPoints.push({
        legendLabel: variant.name,
        value: sum,
      });
    });
    return dataPoints;
  }
}
