import { Injectable, Inject } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  Injector,
  Logger,
  ProductVariantService,
  RequestContext,
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

// Categorize the datapoints per Legend name,
type DataPointsPerLegend = Map<string, number[]>;
interface EntitiesPerMonth<T> {
  monthNr: number;
  year: number;
  entities: T[];
}

@Injectable()
export class MetricsService {
  // Cache for datapoints
  cache = new Cache<AdvancedMetricSummary>();
  metricStrategies: MetricStrategy<unknown>[];
  constructor(
    private moduleRef: ModuleRef,
    private variantService: ProductVariantService,
    @Inject(PLUGIN_INIT_OPTIONS) private pluginOptions: MetricsPluginOptions
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
    const oneYearAgo = startOfMonth(sub(today, { years: 1 }));
    // For each metric strategy
    return Promise.all(
      this.metricStrategies.map(async (metricStrategy) => {
        const cacheKeyObject = {
          code: metricStrategy.code,
          from: today,
          to: oneYearAgo,
          channel: ctx.channel.token,
          variantIds: [] as string[],
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
        const allEntities = await metricStrategy.loadEntities(
          ctx,
          new Injector(this.moduleRef),
          oneYearAgo,
          today,
          variants
        );
        const entitiesPerMonth = this.splitEntitiesInMonths(
          metricStrategy,
          allEntities,
          oneYearAgo,
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
        const monthNames = entitiesPerMonth.map((d) =>
          this.getMonthName(d.monthNr)
        );
        const summary: AdvancedMetricSummary = {
          code: metricStrategy.code,
          title: metricStrategy.getTitle(ctx),
          allowProductSelection: metricStrategy.allowProductSelection,
          labels: monthNames,
          series: this.mapToSeries(dataPointsPerName),
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
   * Map the data points per month map to the AdvancedMetricSeries array
   */
  mapToSeries(dataPointsPerMonth: DataPointsPerLegend): AdvancedMetricSeries[] {
    const series: AdvancedMetricSeries[] = [];
    dataPointsPerMonth.forEach((dataPoints, name) => {
      series.push({
        name,
        values: dataPoints,
      });
    });
    return series;
  }

  /**
   * Categorize loaded entities per month
   */
  splitEntitiesInMonths<T>(
    strategy: MetricStrategy<T>,
    entities: T[],
    from: Date,
    to: Date
  ): EntitiesPerMonth<T>[] {
    // Helper function to construct yearMonth as identifier. E.g. "2021-01"
    const getYearMonth = (date: Date) =>
      `${date.getFullYear()}-${date.getMonth()}`;
    const entitiesPerMonth = new Map<string, EntitiesPerMonth<T>>();
    // Populate the map with all months in the range
    for (let i = from; isBefore(i, to); i = addMonths(i, 1)) {
      const yearMonth = getYearMonth(i);
      entitiesPerMonth.set(yearMonth, {
        monthNr: i.getMonth(),
        year: i.getFullYear(),
        entities: [], // Will be populated below
      });
    }
    // Loop over each item and categorize it in the correct month
    entities.forEach((entity) => {
      const date =
        strategy.getSortableField?.(entity) ??
        ((entity as any).createdAt as Date);
      if (!(date instanceof Date) || isNaN(date as any)) {
        throw Error(
          `${date} is not a valid date! Can not calculate metrics for "${strategy.code}"`
        );
      }
      const yearMonth = getYearMonth(date);
      const entry = entitiesPerMonth.get(yearMonth);
      if (!entry) {
        // Should never happen, but a custom strategy could have fetched data outside of range
        return;
      }
      entry.entities.push(entity);
      entitiesPerMonth.set(yearMonth, entry);
    });
    return Array.from(entitiesPerMonth.values());
  }

  getMonthName(monthNr: number): string {
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
}
