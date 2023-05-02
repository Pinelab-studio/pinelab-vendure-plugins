import { Injectable } from '@nestjs/common';
import {
  MetricInterval,
  MetricSummary,
  MetricSummaryEntry,
  MetricSummaryInput,
} from '../ui/generated/graphql';
import {
  ConfigService,
  ID,
  Logger,
  Order,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import {
  Duration,
  endOfDay,
  getISOWeek,
  getMonth,
  startOfDay,
  sub,
} from 'date-fns';
import { loggerCtx } from '../constants';
import { Cache } from './cache';
import {
  AverageOrderValueMetric,
  NrOfTimesSoldMetric,
  MetricCalculation,
  NrOfOrdersMetric,
} from './strategies';

export type MetricData = {
  orders: Order[];
};

@Injectable()
export class MetricsService {
  cache = new Cache<MetricSummary[]>();
  metricsCalculation: MetricCalculation[];
  constructor(
    private connection: TransactionalConnection,
    private configService: ConfigService
  ) {
    this.metricsCalculation = [
      new AverageOrderValueMetric(),
      new NrOfTimesSoldMetric(),
      new NrOfOrdersMetric(),
    ];
  }

  async getMetrics(
    ctx: RequestContext,
    { interval, variantIds }: MetricSummaryInput
  ): Promise<MetricSummary[]> {
    // Set 23:59:59.999 as endDate
    const endDate = endOfDay(new Date());
    // Check if we have cached result
    const cacheKey = {
      endDate,
      interval,
      channel: ctx.channel.token,
      variantIds,
    };
    const cachedMetricList = this.cache.get(cacheKey);
    if (cachedMetricList) {
      Logger.info(
        `Returning cached metrics for channel ${ctx.channel.token}`,
        loggerCtx
      );
      return cachedMetricList;
    }
    // No cache, calculating new metrics
    Logger.info(
      `No cache hit, calculating ${interval} metrics until ${endDate.toISOString()} for channel ${
        ctx.channel.token
      } for ${
        variantIds?.length
          ? `for order containing product variants with ids ${variantIds}`
          : 'all orders'
      }`,
      loggerCtx
    );
    const data = await this.loadData(
      ctx,
      interval,
      endDate,
      variantIds as string[]
    );
    const metrics: MetricSummary[] = [];
    this.metricsCalculation.forEach((metric) => {
      // Calculate entry (month or week)
      const entries: MetricSummaryEntry[] = [];
      data.forEach((dataPerTick, weekOrMonthNr) => {
        entries.push(
          metric.calculateEntry(ctx, interval, weekOrMonthNr, dataPerTick)
        );
      });
      // Create metric with calculated entries
      metrics.push({
        interval,
        title: metric.getTitle(ctx),
        code: metric.code,
        entries,
      });
    });
    this.cache.set(cacheKey, metrics);
    return metrics;
  }

  async loadData(
    ctx: RequestContext,
    interval: MetricInterval,
    endDate: Date,
    variantIds?: ID[]
  ): Promise<Map<number, MetricData>> {
    let nrOfEntries: number;
    let backInTimeAmount: Duration;
    const orderRepo = this.connection.getRepository(ctx, Order);
    // What function to use to get the current Tick of a date (i.e. the week or month number)
    let getTickNrFn: typeof getMonth | typeof getISOWeek;
    let maxTick: number;
    if (interval === MetricInterval.Monthly) {
      nrOfEntries = 12;
      backInTimeAmount = { months: nrOfEntries };
      getTickNrFn = getMonth;
      maxTick = 12; // max 12 months
    } else {
      // Weekly
      nrOfEntries = 26;
      backInTimeAmount = { weeks: nrOfEntries };
      getTickNrFn = getISOWeek;
      maxTick = 52; // max 52 weeks
    }
    const startDate = startOfDay(sub(endDate, backInTimeAmount));
    const startTick = getTickNrFn(startDate);
    // Get orders in a loop until we have all
    let skip = 0;
    const take = this.configService.apiOptions.adminListQueryLimit;
    let hasMoreOrders = true;
    const orders: Order[] = [];
    while (hasMoreOrders) {
      let query = orderRepo
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.lines', 'orderLine')
        .leftJoin('orderLine.productVariant', 'productVariant')
        .leftJoinAndSelect('orderLine.items', 'orderItems')
        .leftJoin('order.channels', 'orderChannel')
        .where(`orderChannel.id=:channelId`, { channelId: ctx.channelId });
      if (variantIds?.length) {
        query = query.andWhere(`productVariant.id IN(:...variantIds)`, {
          variantIds,
        });
      }
      const [items, nrOfOrders] = await query.getManyAndCount();
      orders.push(...items);
      skip += items.length;
      if (orders.length >= nrOfOrders) {
        hasMoreOrders = false;
      }
    }
    const dataPerInterval = new Map<number, MetricData>();
    const ticks = [];
    for (let i = 1; i <= nrOfEntries; i++) {
      if (startTick + i >= maxTick) {
        // make sure we dont go over month 12 or week 52
        ticks.push(startTick + i - maxTick);
      } else {
        ticks.push(startTick + i);
      }
    }
    ticks.forEach((tick) => {
      const ordersInCurrentTick = orders.filter(
        (order) => getTickNrFn(order.orderPlacedAt!) === tick
      );
      dataPerInterval.set(tick, {
        orders: ordersInCurrentTick,
      });
    });
    return dataPerInterval;
  }
}
