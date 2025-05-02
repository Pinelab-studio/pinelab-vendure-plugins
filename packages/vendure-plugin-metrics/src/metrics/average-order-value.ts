import {
  Injector,
  Logger,
  Order,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { loggerCtx } from '../constants';
import { AdvancedMetricType } from '../ui/generated/graphql';
import { MetricStrategy, NamedDatapoint } from '../services/metric-strategy';

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

  calculateDataPoints(
    ctx: RequestContext,
    entities: Order[]
  ): NamedDatapoint[] {
    let legendLabel = 'Average order value';
    if (ctx.channel.pricesIncludeTax) {
      legendLabel += ' (incl. tax)';
    } else {
      legendLabel += ' (excl. tax)';
    }
    if (!entities.length) {
      // Return 0 as average if no orders
      return [
        {
          legendLabel,
          value: 0,
        },
      ];
    }
    const totalFieldName = ctx.channel.pricesIncludeTax
      ? 'totalWithTax'
      : 'total';
    const total = entities
      .map((o) => o[totalFieldName])
      .reduce((total, current) => total + current, 0);
    const average = Math.round(total / entities.length) / 100;
    return [
      {
        legendLabel,
        value: average,
      },
    ];
  }
}
