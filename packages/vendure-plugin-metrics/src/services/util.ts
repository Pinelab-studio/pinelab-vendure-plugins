import {
  endOfDay,
  endOfMonth,
  format,
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

export interface DataPoint {
  date: Date;
  value: number;
}

/**
 * Sum or average the values of the data points per bucket. Empty buckets are 0.
 */
export function aggregatePerBucket(
  points: DataPoint[],
  buckets: DateRange[],
  aggregate: 'sum' | 'average',
): number[] {
  return buckets.map((bucket) => {
    const values = points
      .filter((p) => p.date >= bucket.start && p.date <= bucket.end)
      .map((p) => p.value);
    if (!values.length) {
      return 0;
    }
    const sum = values.reduce((total, value) => total + value, 0);
    return aggregate === 'sum' ? sum : Math.round(sum / values.length);
  });
}
