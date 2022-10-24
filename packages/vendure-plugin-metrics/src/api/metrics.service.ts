import { Injectable, Inject } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  MetricInterval,
  MetricList,
  MetricListInput,
} from '../ui/generated/graphql';
import { Injector, Logger, RequestContext } from '@vendure/core';
import { Duration, endOfDay, startOfDay, sub } from 'date-fns';
import { nrOfOrders } from './data';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { generatePublicId } from '@vendure/core/dist/common/generate-public-id';
import { MetricsPluginOptions } from '../MetricsPlugin';

@Injectable()
export class MetricsService {
  nrOfPrecedingEntries = 12;

  constructor(
    @Inject(PLUGIN_INIT_OPTIONS) private options: MetricsPluginOptions,
    private moduleRef: ModuleRef
  ) {}

  async getMetrics(
    ctx: RequestContext,
    { interval, endDate }: MetricListInput
  ): Promise<MetricList> {
    endDate = endOfDay(endDate);
    const weeksOrMonths: Duration =
      interval === MetricInterval.Weekly
        ? { weeks: this.nrOfPrecedingEntries }
        : { months: this.nrOfPrecedingEntries };
    const startDate = startOfDay(sub(endDate, weeksOrMonths));
    // Now we have 00:00:000 for the startDate and 23:59:59.999 as endDate
    Logger.info(
      `Fetching metrics for channel ${
        ctx.channel.token
      } from ${startDate.toISOString()} to ${endDate.toISOString()}`,
      loggerCtx
    );
    const injector = new Injector(this.moduleRef);
    const data = this.options.dataLoader(ctx, injector, startDate, endDate);
    const metrics = Promise.all(
      this.options.metricCalculations.map((calc) =>
        calc(ctx, injector, interval, data)
      )
    );
    return {
      id: generatePublicId(),
      startDate,
      endDate,
      interval: MetricInterval.Monthly,
      metrics: [
        {
          id: 'aov',
          title: `Average order value in ${ctx.channel.currencyCode}`,
          data: nrOfOrders.dataset,
        },
      ],
    };
  }
}
