import {
  Injector,
  Order,
  OrderLine,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import type { SelectQueryBuilder } from 'typeorm';
import {
  aggregatePerBucket,
  DailyTotal,
  DateRange,
  getPeriodBuckets,
  PeriodVariation,
  periodVariations,
} from '../services/util';
import type {
  MetricChart,
  MetricDefinition,
  MetricValueFormat,
} from '../types';

/**
 * Base for the built-in metrics: shows a period (past 7 days, past 30 days or past 6 months),
 * compared with the same period one year earlier.
 */
abstract class PeriodComparisonMetric implements MetricDefinition {
  abstract readonly code: string;
  protected abstract readonly valueFormat: MetricValueFormat;
  protected abstract readonly aggregate: 'sum' | 'average';
  readonly perChannel = true;

  protected abstract getTitle(ctx: RequestContext): string;

  /**
   * Load the totals per day (e.g. order totals) of orders placed in the given range.
   */
  protected abstract loadDailyTotals(
    ctx: RequestContext,
    injector: Injector,
    range: DateRange,
  ): Promise<DailyTotal[]>;

  getChartVariations(): string[] {
    return [...periodVariations];
  }

  async loadChart(
    ctx: RequestContext,
    injector: Injector,
    variation: string | undefined,
  ): Promise<MetricChart> {
    const buckets = getPeriodBuckets(variation as PeriodVariation, new Date());
    const toRange = (b: DateRange[]) => ({
      start: b[0].start,
      end: b[b.length - 1].end,
    });
    const current = await this.loadDailyTotals(
      ctx,
      injector,
      toRange(buckets.current),
    );
    const previousYear = await this.loadDailyTotals(
      ctx,
      injector,
      toRange(buckets.previousYear),
    );
    return {
      title: this.getTitle(ctx),
      type: 'line',
      valueFormat: this.valueFormat,
      data: {
        labels: buckets.labels,
        datasets: [
          {
            label: variation ?? '',
            data: aggregatePerBucket(current, buckets.current, this.aggregate),
          },
          {
            label: 'Previous year',
            data: aggregatePerBucket(
              previousYear,
              buckets.previousYear,
              this.aggregate,
            ),
            borderDash: [5, 5],
          },
        ],
      },
    };
  }
}

/**
 * Sum the totals of the orders placed in the given range per day, for the current channel.
 * Uses `totalWithTax` when the channel's prices include tax, otherwise `total`.
 */
async function getDailyOrderTotals(
  ctx: RequestContext,
  injector: Injector,
  range: DateRange,
): Promise<DailyTotal[]> {
  const total = ctx.channel.pricesIncludeTax
    ? 'order.subTotalWithTax + order.shippingWithTax'
    : 'order.subTotal + order.shipping';
  const query = injector
    .get(TransactionalConnection)
    .getRepository(ctx, Order)
    .createQueryBuilder('order')
    .select(`SUM(${total})`, 'total')
    .addSelect('COUNT(order.id)', 'count');
  return getDailyTotals(ctx, query, range);
}

/**
 * Group the given query on `order` per day of `orderPlacedAt`, for placed and not cancelled orders
 * in the current channel. The query must select `total` and `count`.
 * Aggregating in the database prevents loading all orders into memory.
 */
async function getDailyTotals(
  ctx: RequestContext,
  query: SelectQueryBuilder<Order | OrderLine>,
  range: DateRange,
): Promise<DailyTotal[]> {
  const rows = await query
    .addSelect('DATE(order.orderPlacedAt)', 'day')
    .innerJoin('order.channels', 'channel', 'channel.id = :channelId', {
      channelId: ctx.channelId,
    })
    .where('order.orderPlacedAt BETWEEN :start AND :end', range)
    .andWhere('order.state != :cancelled', { cancelled: 'Cancelled' })
    .groupBy('DATE(order.orderPlacedAt)')
    .getRawMany<{ day: string | Date; total: unknown; count: unknown }>();
  // Some drivers return sums as strings
  return rows.map((row) => ({
    day: row.day,
    total: Number(row.total),
    count: Number(row.count),
  }));
}

/**
 * Taxes are included in the title, because they depend on the channel settings
 */
function withTaxLabel(ctx: RequestContext, title: string): string {
  return `${title} (${ctx.channel.pricesIncludeTax ? 'incl.' : 'excl.'} tax)`;
}

/**
 * The total revenue of placed orders
 */
export class RevenueMetric extends PeriodComparisonMetric {
  readonly code = 'revenue';
  protected readonly valueFormat = 'currency';
  protected readonly aggregate = 'sum';

  protected getTitle(ctx: RequestContext): string {
    return withTaxLabel(ctx, 'Revenue');
  }

  protected loadDailyTotals(
    ctx: RequestContext,
    injector: Injector,
    range: DateRange,
  ): Promise<DailyTotal[]> {
    return getDailyOrderTotals(ctx, injector, range);
  }
}

/**
 * The average total of placed orders
 */
export class AverageOrderValueMetric extends PeriodComparisonMetric {
  readonly code = 'aov';
  protected readonly valueFormat = 'currency';
  protected readonly aggregate = 'average';

  protected getTitle(ctx: RequestContext): string {
    return withTaxLabel(ctx, 'Average order value');
  }

  protected loadDailyTotals(
    ctx: RequestContext,
    injector: Injector,
    range: DateRange,
  ): Promise<DailyTotal[]> {
    return getDailyOrderTotals(ctx, injector, range);
  }
}

/**
 * The number of units sold in placed orders
 */
export class UnitsSoldMetric extends PeriodComparisonMetric {
  readonly code = 'units_sold';
  protected readonly valueFormat = 'number';
  protected readonly aggregate = 'sum';

  protected getTitle(): string {
    return 'Units sold';
  }

  protected loadDailyTotals(
    ctx: RequestContext,
    injector: Injector,
    range: DateRange,
  ): Promise<DailyTotal[]> {
    const query = injector
      .get(TransactionalConnection)
      .getRepository(ctx, OrderLine)
      .createQueryBuilder('line')
      .select('SUM(line.quantity)', 'total')
      .addSelect('COUNT(line.id)', 'count')
      .innerJoin('line.order', 'order');
    return getDailyTotals(ctx, query, range);
  }
}

/**
 * The metrics enabled by default. Use `[...defaultMetrics, new MyMetric()]` to add your own.
 */
export const defaultMetrics: MetricDefinition[] = [
  new RevenueMetric(),
  new AverageOrderValueMetric(),
  new UnitsSoldMetric(),
];
