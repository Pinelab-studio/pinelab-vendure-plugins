import { RequestContext } from '@vendure/core';
import { MetricInterval, MetricSummaryEntry } from '../ui/generated/graphql';
import { MetricData } from './metrics.service';

/**
 * Calculate your metric data based on the given input.
 * Be careful with heavy queries and calculations,
 * as this function is executed everytime a user views its dashboard
 *
 */
export interface MetricCalculation {
  code: string;

  getTitle(ctx: RequestContext): string;

  calculateEntry(
    ctx: RequestContext,
    interval: MetricInterval,
    weekOrMonthNr: number,
    data: MetricData
  ): MetricSummaryEntry;
}

export function getMonthName(monthNr: number): string {
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return monthNames[monthNr];
}

/**
 * Calculates the average order value per month/week
 */
export class AverageOrderValueMetric implements MetricCalculation {
  readonly code = 'aov';

  getTitle(ctx: RequestContext): string {
    return `Average order value in ${ctx.channel.currencyCode}`;
  }

  calculateEntry(
    ctx: RequestContext,
    interval: MetricInterval,
    weekOrMonthNr: number,
    data: MetricData
  ): MetricSummaryEntry {
    const label =
      interval === MetricInterval.Monthly
        ? getMonthName(weekOrMonthNr)
        : `Week ${weekOrMonthNr}`;
    if (!data.orders.length) {
      return {
        label,
        value: 0,
      };
    }
    const total = data.orders
      .map((o) => o.totalWithTax)
      .reduce((total, current) => total + current);
    const average = Math.round(total / data.orders.length) / 100;
    return {
      label,
      value: average,
    };
  }
}
/**
 * Calculates the conversion of sessions to orders per month/week
 */
export class NrOfOrdersMetric implements MetricCalculation {
  readonly code = 'nr-of-orders';

  getTitle(ctx: RequestContext): string {
    return `Nr. of orders`;
  }

  calculateEntry(
    ctx: RequestContext,
    interval: MetricInterval,
    weekOrMonthNr: number,
    data: MetricData
  ): MetricSummaryEntry {
    const label =
      interval === MetricInterval.Monthly
        ? getMonthName(weekOrMonthNr)
        : `Week ${weekOrMonthNr}`;
    return {
      label,
      value: data.orders.length,
    };
  }
}

export class NrOfTimesSoldMetric implements MetricCalculation {
  readonly code = 'nr-of-items-sold';

  getTitle(ctx: RequestContext): string {
    return `Nr. of items sold`;
  }

  calculateEntry(
    ctx: RequestContext,
    interval: MetricInterval,
    weekOrMonthNr: number,
    data: MetricData
  ): MetricSummaryEntry {
    const label =
      interval === MetricInterval.Monthly
        ? getMonthName(weekOrMonthNr)
        : `Week ${weekOrMonthNr}`;
    return {
      label,
      value: data.orders.reduce(
        (mainPartialSum, order) =>
          mainPartialSum +
          order.lines.reduce(
            (subPartialSum, line) => subPartialSum + line.quantity,
            0
          ),
        0
      ),
    };
  }
}
