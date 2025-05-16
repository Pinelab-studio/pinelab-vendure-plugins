import { Order, RequestContext } from '@vendure/core';
import { MetricStrategy, NamedDatapoint } from '../services/metric-strategy';
import { Session } from '../services/request-service';
import { AdvancedMetricType } from '../ui/generated/graphql';

/**
 * Number of sessions and device type
 */
export class SessionsMetric implements MetricStrategy {
  readonly metricType: AdvancedMetricType = AdvancedMetricType.Number;
  readonly code = 'sessions';
  readonly allowProductSelection = false;

  getTitle(ctx: RequestContext): string {
    return `Sessions`;
  }

  calculateDataPoints(
    ctx: RequestContext,
    orders: Order[],
    sessions: Session[] = []
  ): NamedDatapoint[] {
    const deviceTypeCounts: { [deviceType: string]: number } = {};
    sessions.forEach((session) => {
      const deviceType = session.deviceType || 'Unknown';
      deviceTypeCounts[deviceType] = (deviceTypeCounts[deviceType] || 0) + 1;
    });
    const totalSessions = sessions.length;
    const dataPoints: NamedDatapoint[] = [
      {
        legendLabel: 'Total sessions',
        value: totalSessions,
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
