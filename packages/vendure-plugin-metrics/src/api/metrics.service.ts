import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, RequestContext } from '@vendure/core';
import { addMonths, endOfDay, isBefore, startOfMonth, sub } from 'date-fns';
import { da } from 'date-fns/locale';
import { loggerCtx } from '../constants';
import {
  AdvancedMetricSeries,
  AdvancedMetricSummary,
  AdvancedMetricSummaryInput,
} from '../ui/generated/graphql';
import { Cache } from './cache';
import { MetricStrategy } from './metric-strategy';
import { AverageOrderValueMetric } from './metrics/average-order-value';
import { SalesPerProductMetric } from './metrics/sales-per-product';

type DataPointsPerMonth = Map<string, number[]>;
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
  constructor(private moduleRef: ModuleRef) {
    this.metricStrategies = [
      new SalesPerProductMetric(),
      new AverageOrderValueMetric(),
    ];
  }

  async getMetrics(
    ctx: RequestContext,
    input?: AdvancedMetricSummaryInput
  ): Promise<AdvancedMetricSummary[]> {
    const today = endOfDay(new Date());
    // Use start of month, because we'd like to see the full results of last years same month
    const oneYearAgo = startOfMonth(sub(today, { years: 1 }));
    // For each metric strategy
    return Promise.all(
      this.metricStrategies.map(async (metricStrategy) => {
        const cacheKey = {
          from: today,
          to: oneYearAgo,
          channel: ctx.channel.token,
          variantIds: input?.variantIds?.sort() ?? [],
        };
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
          input
        );
        const entitiesPerMonth = this.splitEntitiesInMonths(
          metricStrategy,
          allEntities,
          oneYearAgo,
          today
        );
        // Calculate datapoints per 'name', because we could be dealing with a multi line chart
        const dataPointsPerName: DataPointsPerMonth = new Map<
          string,
          number[]
        >();
        entitiesPerMonth.forEach((entityMap) => {
          const calculatedDataPoints = metricStrategy.calculateDataPoints(
            ctx,
            entityMap.entities,
            input
          );
          // Loop over datapoint, because we support multi line charts
          calculatedDataPoints.forEach((dataPoint) => {
            const entry = dataPointsPerName.get(dataPoint.name) ?? [];
            entry.push(dataPoint.value);
            // Add entry, for example `'product1', [10, 20, 30]`
            dataPointsPerName.set(dataPoint.name, entry);
          });
        });
        const monthNames = entitiesPerMonth.map((d) =>
          this.getMonthName(d.monthNr)
        );
        const summary: AdvancedMetricSummary = {
          code: metricStrategy.code,
          title: metricStrategy.getTitle(ctx),
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
  mapToSeries(dataPointsPerMonth: DataPointsPerMonth): AdvancedMetricSeries[] {
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
