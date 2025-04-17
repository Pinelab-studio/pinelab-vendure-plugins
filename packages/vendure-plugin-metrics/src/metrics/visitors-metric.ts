import { Order, RequestContext } from '@vendure/core';
import { MetricStrategy, NamedDatapoint } from '../services/metric-strategy';
import { Visit } from '../services/request-service';
import { AdvancedMetricType } from '../ui/generated/graphql';

/**
 * Number of visitors and device type
 */
export class VisitorsMetric implements MetricStrategy {
  readonly metricType: AdvancedMetricType = AdvancedMetricType.Number;
  readonly code = 'visitors';
  readonly allowProductSelection = false;

  getTitle(ctx: RequestContext): string {
    return `Visitors`;
  }

  calculateDataPoints(
    ctx: RequestContext,
    orders: Order[],
    visits: Visit[] = []
  ): NamedDatapoint[] {
    const deviceTypeCounts: { [deviceType: string]: number } = {};
    visits.forEach((visit) => {
      const deviceType = visit.deviceType || 'Unknown';
      deviceTypeCounts[deviceType] = (deviceTypeCounts[deviceType] || 0) + 1;
    });
    const totalVisitors = visits.length;
    const dataPoints: NamedDatapoint[] = [
      {
        legendLabel: 'Total Visitors',
        value: totalVisitors,
      },
    ];
    for (const [deviceType, count] of Object.entries(deviceTypeCounts)) {
      dataPoints.push({
        legendLabel: deviceType,
        value: count,
      });
    }
    return dataPoints;
  }
}
