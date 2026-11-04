import {
  endOfDay,
  endOfMonth,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';
import type { MetricChart } from '../types';

/**
 * Throws when the given value is not a valid {@link MetricChart}, so that
 * invalid charts are never stored and shown in the dashboard.
 */
export function validateMetricChart(chart: unknown): MetricChart {
  const c = chart as Partial<MetricChart> | undefined;
  if (!c || typeof c !== 'object') {
    throw Error('Chart must be an object');
  }
  if (typeof c.title !== 'string' || !c.title) {
    throw Error(`Chart must have a 'title'`);
  }
  if (typeof c.type !== 'string' || !c.type) {
    throw Error(`Chart must have a Chart.js 'type'`);
  }
  if (!c.data || !Array.isArray(c.data.datasets)) {
    throw Error(`Chart must have Chart.js 'data' with a 'datasets' array`);
  }
  if (c.valueFormat && !['currency', 'number'].includes(c.valueFormat)) {
    throw Error(`Chart 'valueFormat' must be 'currency' or 'number'`);
  }
  return c as MetricChart;
}

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * The buckets (days or months) of a period, plus the same buckets one year earlier.
 */
export interface PeriodBuckets {
  labels: string[];
  current: DateRange[];
  previousYear: DateRange[];
}

/**
 * The variations of the built-in metrics
 */
export const periodVariations = [
  'Past 7 days',
  'Past 30 days',
  'Past 6 months',
] as const;

export type PeriodVariation = (typeof periodVariations)[number];

/**
 * Get the daily or monthly buckets for the given period, ending with today or the current month.
 */
export function getPeriodBuckets(
  period: PeriodVariation,
  now: Date,
): PeriodBuckets {
  const days = period === 'Past 7 days' ? 7 : 30;
  const current: DateRange[] =
    period === 'Past 6 months'
      ? Array.from({ length: 6 }, (_, i) => {
          const month = startOfMonth(subMonths(now, 5 - i));
          return { start: month, end: endOfMonth(month) };
        })
      : Array.from({ length: days }, (_, i) => {
          const day = startOfDay(subDays(now, days - 1 - i));
          return { start: day, end: endOfDay(day) };
        });
  const labelFormat = period === 'Past 6 months' ? 'MMM' : 'd MMM';
  return {
    labels: current.map((range) => format(range.start, labelFormat)),
    current,
    previousYear: current.map((range) => ({
      start: subYears(range.start, 1),
      end: subYears(range.end, 1),
    })),
  };
}

/**
 * The aggregated value of a single day, e.g. the summed order totals and the number of orders
 */
export interface DailyTotal {
  /**
   * The day as returned by SQL `DATE()`: a 'YYYY-MM-DD' string or a Date, depending on the database driver
   */
  day: string | Date;
  total: number;
  count: number;
}

/**
 * Sum or average the daily totals per bucket. Averages are weighted by count,
 * e.g. total revenue divided by number of orders. Empty buckets are 0.
 */
export function aggregatePerBucket(
  dailyTotals: DailyTotal[],
  buckets: DateRange[],
  aggregate: 'sum' | 'average',
): number[] {
  const days = dailyTotals.map((d) => ({
    ...d,
    date: d.day instanceof Date ? d.day : parseISO(d.day),
  }));
  return buckets.map((bucket) => {
    const inBucket = days.filter(
      (d) => d.date >= bucket.start && d.date <= bucket.end,
    );
    const total = inBucket.reduce((sum, d) => sum + d.total, 0);
    const count = inBucket.reduce((sum, d) => sum + d.count, 0);
    if (!count) {
      return 0;
    }
    return aggregate === 'sum' ? total : Math.round(total / count);
  });
}
