import { Order, RequestContext } from '@vendure/core';
import { MetricStrategy, NamedDatapoint } from '../services/metric-strategy';
import { Session } from '../services/request-service';
import { AdvancedMetricType } from '../ui/generated/graphql';

/**
 * Conversion of sessions to orders
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
    sessions: Session[]
  ): NamedDatapoint[] {
    const placedOrders = orders.length;
    const sessionCount = sessions.length;
    // Calculate conversion rate (as a percentage)
    let conversionRate = 0;
    if (sessionCount > 0) {
      conversionRate = (placedOrders / sessionCount) * 100;
    }
    if (conversionRate > 100) {
      // Conversion rate cannot be more than 100%
      conversionRate = 100;
    }
    return [
      {
        legendLabel: 'Conversion of sessions to orders (%)',
        value: parseFloat(conversionRate.toFixed(2)),
      },
    ];
  }
}
