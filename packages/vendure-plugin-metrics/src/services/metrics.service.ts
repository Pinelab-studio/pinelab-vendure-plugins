import { Injectable, Inject } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  Injector,
  Logger,
  Order,
  ProductVariant,
  ProductVariantService,
  RequestContext,
  TransactionalConnection,
  TransactionIsolationLevel,
} from '@vendure/core';
import { addMonths, endOfDay, isBefore, startOfMonth, sub } from 'date-fns';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { MetricsPluginOptions } from '../metrics.plugin';
import {
  AdvancedMetricSeries,
  AdvancedMetricSummary,
  AdvancedMetricSummaryInput,
} from '../ui/generated/graphql';
import { Cache } from './cache';
import { MetricStrategy } from './metric-strategy';
import {
  DataPointsPerLegend,
  getMonthName,
  mapToSeries,
  groupEntitiesPerMonth,
} from './metric-util';

@Injectable()
export class MetricsService {
  // Cache for datapoints
  cache = new Cache<AdvancedMetricSummary>();
  metricStrategies: MetricStrategy[];
  constructor(
    private moduleRef: ModuleRef,
    private variantService: ProductVariantService,
    @Inject(PLUGIN_INIT_OPTIONS) private pluginOptions: MetricsPluginOptions,
    private connection: TransactionalConnection
  ) {
    this.metricStrategies = this.pluginOptions.metrics;
  }

  async getMetrics(
    ctx: RequestContext,
    input?: AdvancedMetricSummaryInput
  ): Promise<AdvancedMetricSummary[]> {
    const variants = await this.variantService.findByIds(
      ctx,
      input?.variantIds ?? []
    );
    const today = endOfDay(new Date());
    // Use start of month, because we'd like to see the full results of last years same month
    const startDate = startOfMonth(
      sub(today, { months: this.pluginOptions.displayPastMonths })
    );
    const orders = await this.getOrders(ctx, startDate, today, variants);
    // For each metric strategy
    return Promise.all(
      this.metricStrategies.map(async (metricStrategy) => {
        const cacheKeyObject = {
          code: metricStrategy.code,
          from: startDate.toDateString(),
          to: today.toDateString(),
          channel: ctx.channel.token,
          variantIds: [] as string[], // Set below if input is given
        };
        if (metricStrategy.allowProductSelection) {
          // Only use variantIds for cache key if the strategy allows filtering by variants
          cacheKeyObject.variantIds = input?.variantIds?.sort() ?? [];
        }
        const cacheKey = JSON.stringify(cacheKeyObject);
        // Return cached result if exists
        const cachedMetricSummary = this.cache.get(cacheKey);
        if (cachedMetricSummary) {
          Logger.info(
            `Using cached data for metric "${metricStrategy.code}"`,
            loggerCtx
          );
          return cachedMetricSummary;
        }
        // Log execution time, because custom strategies can be heavy and we need to inform the user about it
        const start = performance.now();
        const entitiesPerMonth = groupEntitiesPerMonth(
          orders,
          'orderPlacedAt',
          startDate,
          today
        );
        // Calculate datapoints per 'name', because we could be dealing with a multi line chart
        const dataPointsPerName: DataPointsPerLegend = new Map<
          string,
          number[]
        >();
        entitiesPerMonth.forEach((entityMap) => {
          const calculatedDataPoints = metricStrategy.calculateDataPoints(
            ctx,
            entityMap.entities,
            variants
          );
          // Loop over datapoint, because we support multi line charts
          calculatedDataPoints.forEach((dataPoint) => {
            const entry = dataPointsPerName.get(dataPoint.legendLabel) ?? [];
            entry.push(dataPoint.value);
            // Add entry, for example `'product1', [10, 20, 30]`
            dataPointsPerName.set(dataPoint.legendLabel, entry);
          });
        });
        const monthNames = entitiesPerMonth.map((d) => getMonthName(d.monthNr));
        const summary: AdvancedMetricSummary = {
          code: metricStrategy.code,
          title: metricStrategy.getTitle(ctx),
          allowProductSelection: metricStrategy.allowProductSelection,
          labels: monthNames,
          series: mapToSeries(dataPointsPerName),
          type: metricStrategy.metricType,
        };
        const stop = performance.now();
        Logger.info(
          `No cache hit, loaded data for metric "${
            metricStrategy.code
          }" in ${Math.round(stop - start)}ms`,
          loggerCtx
        );
        this.cache.set(cacheKey, summary);
        return summary;
      })
    );
  }

  /**
   * Get orders with their lines in the given date range
   */
  async getOrders(
    ctx: RequestContext,
    from: Date,
    to: Date,
    variants: ProductVariant[] = []
  ): Promise<Order[]> {
    let skip = 0;
    const take = 500;
    let hasMoreOrders = true;
    const orders: Order[] = [];

    while (hasMoreOrders) {
      let query = this.connection
        .getRepository(ctx, Order)
        .createQueryBuilder('order')
        // Join order lines - this replaces the separate OrderLine queries
        .leftJoinAndSelect('order.lines', 'orderLine')
        // Select the specific fields needed from orderLine
        .addSelect('orderLine.quantity')
        // Join channels as before
        .leftJoin('order.channels', 'channel')
        .where('channel.id = :channelId', { channelId: ctx.channelId })
        .andWhere('order.orderPlacedAt BETWEEN :fromDate AND :toDate', {
          fromDate: from.toISOString(),
          toDate: to.toISOString(),
        });

      // Add variant filtering if variants are specified
      if (variants.length) {
        query = query
          .leftJoinAndSelect('orderLine.productVariant', 'productVariant')
          .andWhere('productVariant.id IN (:...variantIds)', {
            variantIds: variants.map((v) => v.id),
          });
      }

      // Add pagination
      query = query.offset(skip).limit(take);

      const [items, totalOrders] = await query.getManyAndCount();
      orders.push(...items);

      Logger.debug(
        `Fetched orders ${skip}-${skip + take} with order lines for channel ${
          ctx.channel.token
        }`,
        loggerCtx
      );

      skip += items.length;
      if (orders.length >= totalOrders) {
        hasMoreOrders = false;
      }
    }

    return orders;
  }
}
