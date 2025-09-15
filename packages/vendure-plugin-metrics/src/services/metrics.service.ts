import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { JobState } from '@vendure/common/lib/generated-types';
import {
  ID,
  JobQueue,
  JobQueueService,
  Logger,
  Order,
  ProductVariant,
  ProductVariantService,
  RequestContext,
  SerializedRequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { endOfDay, startOfMonth, sub } from 'date-fns';
import { PLUGIN_INIT_OPTIONS, loggerCtx } from '../constants';
import { MetricsPluginOptions } from '../metrics.plugin';
import {
  AdvancedMetricSummary,
  AdvancedMetricSummaryInput,
} from '../ui/generated/graphql';
import { MetricStrategy } from './metric-strategy';
import {
  DataPointsPerLegend,
  getEntitiesForMonth,
  getMonthName,
  groupEntitiesPerMonth,
  mapToSeries,
} from './metric-util';
import { MetricSummary } from '../entities/metric-summary.entity';

@Injectable()
export class MetricsService implements OnModuleInit {
  private generateMetricsQueue!: JobQueue<{
    ctx: SerializedRequestContext;
    startDate: string; // ISO string
    endDate: string; // ISO string
    variantIds: string[];
  }>;

  readonly metricStrategies: MetricStrategy[];
  constructor(
    private variantService: ProductVariantService,
    @Inject(PLUGIN_INIT_OPTIONS) private options: MetricsPluginOptions,
    private connection: TransactionalConnection,
    private jobQueueService: JobQueueService
  ) {
    this.metricStrategies = this.options.metrics;
  }

  public async onModuleInit(): Promise<void> {
    this.generateMetricsQueue = await this.jobQueueService.createQueue({
      name: 'generate-metrics',
      process: async (job) => {
        // Deserialize the RequestContext from the job data
        const ctx = RequestContext.deserialize(job.data.ctx);
        const startDate = new Date(job.data.startDate);
        const endDate = new Date(job.data.endDate);
        const variantIds = job.data.variantIds;
        await this.handleMetricsJob(ctx, startDate, endDate, variantIds).catch(
          (e) => {
            Logger.error(
              `Error processing 'generate-metrics' job: ${e}`,
              loggerCtx
            );
            throw e;
          }
        );
      },
    });
  }

  /**
   * Get metrics from cache, or create a job and keep polling the cache
   */
  async getMetrics(
    ctx: RequestContext,
    input?: AdvancedMetricSummaryInput
  ): Promise<AdvancedMetricSummary[]> {
    const today = endOfDay(new Date());
    // Use start of month, because we'd like to see the full results of last years same month
    const startDate = startOfMonth(
      sub(today, { months: this.options.displayPastMonths })
    );
    const metrics = await this.getAllMetricsFromCache(
      ctx,
      startDate,
      today,
      input?.variantIds ?? []
    );
    if (metrics) {
      Logger.info(
        `Loaded data for ${metrics.length} metrics from cache.`,
        loggerCtx
      );
      // All metrics were found in cache, return them
      return metrics;
    }
    // If not in cache, add job to queue
    await this.generateMetricsQueue.add(
      {
        ctx: ctx.serialize(),
        startDate: startDate.toISOString(),
        endDate: today.toISOString(),
        variantIds: input?.variantIds ?? [],
      },
      { retries: 2 }
    );
    Logger.info(`Added 'generate-metrics' job to queue for metric`, loggerCtx);
    // Poll every 1 seconds for the job to finish, with a timeout of 1 minute
    for (let i = 0; i < 60; i++) {
      Logger.info(
        `Waiting for 'generate-metrics' job to finish... (${i + 1}/60)`,
        loggerCtx
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const metrics = await this.getAllMetricsFromCache(
        ctx,
        startDate,
        today,
        input?.variantIds ?? []
      );
      if (metrics) {
        Logger.info(
          `Loaded data for ${metrics.length} metrics from cache.`,
          loggerCtx
        );
        return metrics;
      }
    }
    throw Error(`Timeout waiting for 'generate-metrics' job to finish`);
  }

  /**
   * Get all metrics from cache.
   * If any of the metrics is missing, returns undefined
   */
  async getAllMetricsFromCache(
    ctx: RequestContext,
    from: Date,
    to: Date,
    variantIds: ID[]
  ): Promise<AdvancedMetricSummary[] | undefined> {
    const metrics: AdvancedMetricSummary[] = [];
    for (const metricStrategy of this.metricStrategies) {
      const cacheKey = this.createCacheKey(
        ctx,
        metricStrategy,
        from,
        to,
        variantIds ?? []
      );
      // Return cached result if exists
      let cachedMetricSummary = await this.findMetricSummary(ctx, cacheKey);
      if (cachedMetricSummary) {
        metrics.push(cachedMetricSummary.summaryData);
      } else {
        // If any of the metrics is missing, return now
        return;
      }
    }
    if (metrics.length === this.metricStrategies.length) {
      // All metrics were found in cache, return them
      return metrics;
    }
  }

  /**
   * Generate metrics for each strategy, and store them in the cache.
   */
  async handleMetricsJob(
    ctx: RequestContext,
    startDate: Date,
    endDate: Date,
    variantIds: ID[]
  ) {
    // Check cache before processing because another job could have completed in the meantime
    const metrics = await this.getAllMetricsFromCache(
      ctx,
      startDate,
      endDate,
      variantIds
    );
    if (metrics) {
      // All metrics were found in cache, return them
      return metrics;
    }
    const start = performance.now();
    const variants = await this.variantService.findByIds(ctx, variantIds);
    const orders = await this.getPlacedOrders(
      ctx,
      startDate,
      endDate,
      variants
    );
    const ordersPerMonth = groupEntitiesPerMonth(
      orders,
      'orderPlacedAt',
      startDate,
      endDate
    );
    await Promise.all(
      this.metricStrategies.map(async (metricStrategy) => {
        // Calculate datapoints per 'name', because we could be dealing with a multi line chart
        const dataPointsPerName: DataPointsPerLegend = new Map<
          string,
          number[]
        >();
        ordersPerMonth.forEach((entityMap) => {
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
        const monthNames = ordersPerMonth.map((d) => getMonthName(d.monthNr));
        const summary: AdvancedMetricSummary = {
          code: metricStrategy.code,
          title: metricStrategy.getTitle(ctx),
          allowProductSelection: metricStrategy.allowProductSelection,
          labels: monthNames,
          series: mapToSeries(dataPointsPerName),
          type: metricStrategy.metricType,
        };
        const cacheKey = this.createCacheKey(
          ctx,
          metricStrategy,
          startDate,
          endDate,
          variantIds
        );
        await this.saveMetricSummary(ctx, cacheKey, summary);
      })
    );
    const stop = performance.now();
    Logger.info(
      `Generated metrics for channel ${ctx.channel.token} in ${Math.round(
        stop - start
      )}ms`,
      loggerCtx
    );
  }

  /**
   * Get orders with their lines in the given date range
   */
  async getPlacedOrders(
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
        // Join channels as before
        .leftJoin('order.channels', 'channel')
        .where('channel.id = :channelId', { channelId: ctx.channelId })
        .andWhere('order.orderPlacedAt BETWEEN :fromDate AND :toDate', {
          fromDate: from.toISOString(),
          toDate: to.toISOString(),
        })
        .orderBy('order.orderPlacedAt', 'ASC');

      // Add variant filtering if variants are specified
      if (variants.length) {
        query = query
          .leftJoinAndSelect('orderLine.productVariant', 'productVariant')
          .andWhere('productVariant.id IN (:...variantIds)', {
            variantIds: variants.map((v) => v.id),
          });
      }

      // Add pagination
      query = query.skip(skip).take(take);

      const [items, totalOrders] = await query.getManyAndCount();
      orders.push(...items);
      if (items.length > 0) {
        const firstDate = items[0].orderPlacedAt?.toISOString().split('T')[0];
        const lastDate = items[items.length - 1].orderPlacedAt
          ?.toISOString()
          .split('T')[0];
        Logger.info(
          `Fetched orders ${skip}-${
            skip + take
          } (${firstDate} to ${lastDate}) for channel ${ctx.channel.token}`,
          loggerCtx
        );
      }

      skip += items.length;
      if (orders.length >= totalOrders) {
        hasMoreOrders = false;
      }
    }

    return orders;
  }

  async findMetricSummary(
    ctx: RequestContext,
    cacheKey: string
  ): Promise<MetricSummary | undefined | null> {
    return await this.connection
      .getRepository(ctx, MetricSummary)
      .findOne({ where: { key: cacheKey, channelId: ctx.channelId } });
  }

  async saveMetricSummary(
    ctx: RequestContext,
    cacheKey: string,
    summary: AdvancedMetricSummary
  ): Promise<MetricSummary | undefined | null> {
    // Check if the summary already exists
    const existingSummary = await this.findMetricSummary(ctx, cacheKey);
    return await this.connection.getRepository(ctx, MetricSummary).save({
      id: existingSummary?.id,
      key: cacheKey,
      summaryData: summary,
      channelId: ctx.channelId,
    });
  }

  /**
   * Create an identifier to store metrics in the cache.
   */
  private createCacheKey(
    ctx: RequestContext,
    strategy: MetricStrategy,
    from: Date,
    to: Date,
    variantIds: ID[]
  ) {
    const cacheKeyObject = {
      code: strategy.code,
      from: from.toISOString(),
      to: to.toISOString(),
      channel: ctx.channel.token,
      variantIds: [] as ID[],
    };
    if (strategy.allowProductSelection) {
      // Only use variantIds for cache key if the strategy allows filtering by variants
      cacheKeyObject.variantIds = variantIds?.sort() ?? [];
    }
    return JSON.stringify(cacheKeyObject);
  }
}
