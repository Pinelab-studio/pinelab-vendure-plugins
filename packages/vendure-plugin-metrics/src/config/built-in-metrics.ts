import {
  Injector,
  Order,
  OrderLine,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import {
  aggregatePerBucket,
  DataPoint,
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
   * Load the data points (e.g. order totals) placed in the given range.
   */
  protected abstract loadDataPoints(
    ctx: RequestContext,
    injector: Injector,
    range: DateRange,
  ): Promise<DataPoint[]>;

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
    const current = await this.loadDataPoints(
      ctx,
      injector,
      toRange(buckets.current),
    );
    const previousYear = await this.loadDataPoints(
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
 * Get the totals of the orders placed in the given range, for the current channel.
 * Uses `totalWithTax` when the channel's prices include tax, otherwise `total`.
 */
async function getOrderTotals(
  ctx: RequestContext,
  injector: Injector,
  range: DateRange,
): Promise<DataPoint[]> {
  const orders = await injector
    .get(TransactionalConnection)
    .getRepository(ctx, Order)
    .createQueryBuilder('order')
    .select([
      'order.id',
      'order.orderPlacedAt',
      'order.subTotal',
      'order.subTotalWithTax',
      'order.shipping',
      'order.shippingWithTax',
    ])
    .innerJoin('order.channels', 'channel', 'channel.id = :channelId', {
      channelId: ctx.channelId,
    })
    .where('order.orderPlacedAt BETWEEN :start AND :end', range)
    .getMany();
  return orders.map((order) => ({
    date: order.orderPlacedAt as Date,
    value: ctx.channel.pricesIncludeTax ? order.totalWithTax : order.total,
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

  protected loadDataPoints(
    ctx: RequestContext,
    injector: Injector,
    range: DateRange,
  ): Promise<DataPoint[]> {
    return getOrderTotals(ctx, injector, range);
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

  protected loadDataPoints(
    ctx: RequestContext,
    injector: Injector,
    range: DateRange,
  ): Promise<DataPoint[]> {
    return getOrderTotals(ctx, injector, range);
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

  protected async loadDataPoints(
    ctx: RequestContext,
    injector: Injector,
    range: DateRange,
  ): Promise<DataPoint[]> {
    const lines = await injector
      .get(TransactionalConnection)
      .getRepository(ctx, OrderLine)
      .createQueryBuilder('line')
      .select(['line.id', 'line.quantity', 'order.id', 'order.orderPlacedAt'])
      .innerJoin('line.order', 'order')
      .innerJoin('order.channels', 'channel', 'channel.id = :channelId', {
        channelId: ctx.channelId,
      })
      .where('order.orderPlacedAt BETWEEN :start AND :end', range)
      .getMany();
    return lines.map((line) => ({
      date: line.order.orderPlacedAt as Date,
      value: line.quantity,
    }));
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
