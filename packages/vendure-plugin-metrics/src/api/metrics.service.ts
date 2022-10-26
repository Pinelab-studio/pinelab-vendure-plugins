import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  Metric,
  MetricEntry,
  MetricInterval,
  MetricList,
  MetricListInput,
} from '../ui/generated/graphql';
import {
  Injector,
  ListQueryBuilder,
  Logger,
  Order,
  RequestContext,
  Session,
  TransactionalConnection,
} from '@vendure/core';
import {
  differenceInMonths,
  differenceInWeeks,
  Duration,
  endOfDay,
  getISOWeek,
  getMonth,
  startOfDay,
  sub,
} from 'date-fns';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { generatePublicId } from '@vendure/core/dist/common/generate-public-id';
import { MetricsPluginOptions } from '../MetricsPlugin';
import { Cache } from './cache';
import { Between } from 'typeorm';

export type MetricData = {
  orders: Order[];
  sessions: Session[];
};

@Injectable()
export class MetricsService {
  nrOfEntries = 12;
  cache = new Cache<MetricList>();

  constructor(
    @Inject(PLUGIN_INIT_OPTIONS) private options: MetricsPluginOptions,
    private listBuilder: ListQueryBuilder,
    private connection: TransactionalConnection
  ) {}

  async getMetrics(
    ctx: RequestContext,
    { interval }: MetricListInput
  ): Promise<MetricList> {
    // Set 23:59:59.999 as endDate
    const endDate = endOfDay(new Date());
    // Check if we have cached result
    const cacheKey = { endDate, interval, channel: ctx.channel.token };
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
      `No cache hit, calculating ${
        this.nrOfEntries
      } ${interval} metric entries before ${endDate.toISOString()} for channel ${
        ctx.channel.token
      }`,
      loggerCtx
    );
    const data = await this.loadData(ctx, interval, endDate);
    const metrics: Metric[] = [];
    this.options.metrics.forEach((metric) => {
      // Calculate entry (month or week)
      const entries: MetricEntry[] = [];
      data.forEach((dataPerStep, weekOrMonthNr) => {
        const entry = metric.calculateEntry(
          ctx,
          interval,
          weekOrMonthNr,
          dataPerStep
        );
        entries.push(entry);
      });
      // Create metric with calculated entries
      metrics.push({
        title: metric.getTitle(ctx),
        code: metric.code,
        entries,
      });
    });
    const metricList: MetricList = {
      id: generatePublicId(),
      interval,
      metrics,
    };
    this.cache.set(cacheKey, metricList);
    return metricList;
  }

  async loadData(
    ctx: RequestContext,
    interval: MetricInterval,
    endDate: Date
  ): Promise<Map<number, MetricData>> {
    const weeksOrMonths: Duration =
      interval === MetricInterval.Weekly
        ? { weeks: this.nrOfEntries }
        : { months: this.nrOfEntries };
    const startDate = startOfDay(sub(endDate, weeksOrMonths));
    // Get orders in a loop until we have all
    let skip = 0;
    const take = 1000;
    let hasMoreOrders = true;
    const orders: Order[] = [];
    while (hasMoreOrders) {
      const [items, nrOfOrders] = await this.listBuilder
        .build(
          Order,
          {
            skip,
            take,
          },
          {
            ctx,
            relations: this.options.orderRelations || [],
            channelId: ctx.channelId,
            where: {
              orderPlacedAt: Between(
                startDate.toISOString(),
                endDate.toISOString()
              ),
            },
          }
        )
        .getManyAndCount();
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
          updatedAt: Between(startDate.toISOString(), endDate.toISOString()),
          createdAt: Between(startDate.toISOString(), endDate.toISOString()),
        });
      sessions.push(...items);
      skip += items.length;
      if (sessions.length >= nrOfSessions) {
        hasMoreSessions = false;
      }
    }
    // Get week and month nrs
    const dataPerInterval = new Map<number, MetricData>();
    const start =
      interval === MetricInterval.Monthly
        ? getMonth(startDate)
        : getISOWeek(startDate);
    const weekOrMonthNrs = [];
    const max = interval === MetricInterval.Monthly ? 12 : 52;
    for (let i = 1; i <= this.nrOfEntries; i++) {
      if (start + i >= max) {
        // make sure we dont go over 12 months or 52 weeks
        weekOrMonthNrs.push(start + i - max);
      } else {
        weekOrMonthNrs.push(start + i);
      }
    }
    weekOrMonthNrs.forEach((weekOrMonthNr) => {
      const getMonthOrWeekNrFn =
        interval === MetricInterval.Monthly ? getMonth : getISOWeek;
      const ordersInThisStep = orders.filter(
        (order) => getMonthOrWeekNrFn(order.orderPlacedAt!) === weekOrMonthNr
      );
      const sessionsInThisStep = sessions.filter(
        (session) =>
          getMonthOrWeekNrFn(session.createdAt) === weekOrMonthNr ||
          getMonthOrWeekNrFn(session.updatedAt)
      );
      dataPerInterval.set(weekOrMonthNr, {
        orders: ordersInThisStep,
        sessions: sessionsInThisStep,
      });
    });
    return dataPerInterval;
  }
}
