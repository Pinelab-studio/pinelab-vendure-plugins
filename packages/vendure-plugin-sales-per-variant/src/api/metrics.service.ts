import { Inject, Injectable } from '@nestjs/common';
import {
  MetricInterval,
  MetricSummary,
  MetricSummaryEntry,
  MetricSummaryInput,
} from '../ui/generated/graphql';
import {
  ConfigService,
  ID,
  ListQueryBuilder,
  Logger,
  Order,
  RequestContext,
  Session,
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
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { SalesPerVariantPluginOptions } from '../SalesPerVariantPlugin';
import { Cache } from './cache';
import { Between } from 'typeorm';

export type MetricData = {
  orders: Order[];
  sessions: Session[];
};

@Injectable()
export class MetricsService {
  cache = new Cache<MetricSummary[]>();

  constructor(
    @Inject(PLUGIN_INIT_OPTIONS) private options: SalesPerVariantPluginOptions,
    private listBuilder: ListQueryBuilder,
    private connection: TransactionalConnection,
    private configService: ConfigService
  ) {}

  async getMetrics(
    ctx: RequestContext,
    { interval, variantId }: MetricSummaryInput
  ): Promise<MetricSummary[]> {
    // Set 23:59:59.999 as endDate
    const endDate = endOfDay(new Date());
    // Check if we have cached result
    const cacheKey = {
      endDate,
      interval,
      channel: ctx.channel.token,
      variantId,
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
        variantId
          ? `for order containing product variant with id ${variantId}`
          : 'all orders'
      }`,
      loggerCtx
    );
    const data = await this.loadData(ctx, interval, endDate, variantId!);
    const metrics: MetricSummary[] = [];
    this.options.metrics.forEach((metric) => {
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
    variantId?: ID
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
        .leftJoin('order.lines', 'orderLine')
        .leftJoin('orderLine.productVariant', 'productVariant')
        .leftJoin('orderLine.items', 'orderItems')
        .leftJoin('order.channels', 'orderChannel')
        .where(`orderChannel.id=:channelId`, { channelId: ctx.channelId });
      if (variantId) {
        query = query.andWhere(`productVariant.id=:variantId`, { variantId });
      }
      const [items, nrOfOrders] = await query.getManyAndCount();
      orders.push(...items);
      skip += items.length;
      if (orders.length >= nrOfOrders) {
        hasMoreOrders = false;
      }
    }
    // Get sessions created or update in given time
    const sessions: Session[] = [];
    skip = 0;
    let hasMoreSessions = true;
    while (hasMoreSessions) {
      const [items, nrOfSessions] = await this.connection.rawConnection
        .getRepository(Session)
        .findAndCount({
          select: ['updatedAt'],
          where: {
            updatedAt: Between(startDate.toISOString(), endDate.toISOString()),
          },
        });
      sessions.push(...items);
      skip += items.length;
      if (sessions.length >= nrOfSessions) {
        hasMoreSessions = false;
      }
    }
    // Get ticks (weeks or months depending on the interval)
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
      const sessionsInCurrentTick = sessions.filter(
        (session) => getTickNrFn(session.updatedAt) === tick
      );
      dataPerInterval.set(tick, {
        orders: ordersInCurrentTick,
        sessions: sessionsInCurrentTick,
      });
    });
    return dataPerInterval;
  }
}
