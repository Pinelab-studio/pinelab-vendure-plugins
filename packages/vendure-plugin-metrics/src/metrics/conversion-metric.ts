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
import { Visit } from '../services/request-service';

/**
 * Conversion of visitors to orders
 */
export class ConversionMetric implements MetricStrategy {
  readonly metricType: AdvancedMetricType = AdvancedMetricType.Number;
  readonly code = 'conversion';
  readonly allowProductSelection = false;

  getTitle(ctx: RequestContext): string {
    return `Conversion Rate`;
  }

  calculateDataPoints(
    ctx: RequestContext,
    orders: Order[],
    visits: Visit[] = []
  ): NamedDatapoint[] {
    const placedOrders = orders.length;
    const visitorCount = visits.length ?? 1;
    // Calculate conversion rate (as a percentage)
    let conversionRate = (placedOrders / visitorCount) * 100;
    if (conversionRate > 100) {
      // Conversion rate cannot be more than 100%
      conversionRate = 100;
    }
    return [
      {
        legendLabel: 'Conversion Rate (%)',
        value: parseFloat(conversionRate.toFixed(2)),
      },
    ];
  }
}
