import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  Channel,
  ChannelService,
  Injector,
  Logger,
  RequestContext,
  RequestContextService,
  TransactionalConnection,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import { IsNull } from 'typeorm';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { MetricResult } from '../entities/metric-result.entity';
import type { MetricDefinition, MetricsPluginOptions } from '../types';
import { validateMetricChart } from './util';

interface MetricGenerationResult {
  code: string;
  channel: string | null;
  variations: Array<{
    variation: string | null;
    durationMs: number;
    success: boolean;
    error?: string;
  }>;
  error?: string;
}

@Injectable()
export class MetricsService {
  private readonly injector: Injector;

  constructor(
    @Inject(PLUGIN_INIT_OPTIONS) private readonly options: MetricsPluginOptions,
    private readonly connection: TransactionalConnection,
    private readonly channelService: ChannelService,
    private readonly requestContextService: RequestContextService,
    moduleRef: ModuleRef,
  ) {
    this.injector = new Injector(moduleRef);
  }

  /**
   * Get the stored charts of a metric for the current channel, ordered by variation.
   * Never calculates anything: charts are only calculated by the scheduled task.
   */
  async getCharts(ctx: RequestContext, code: string): Promise<MetricResult[]> {
    const metric = this.options.metrics.find((m) => m.code === code);
    if (!metric) {
      // Results of metrics that are no longer configured are hidden
      return [];
    }
    return await this.connection.getRepository(ctx, MetricResult).find({
      where: {
        code,
        channelId: metric.perChannel ? String(ctx.channelId) : IsNull(),
      },
      order: { position: 'ASC' },
    });
  }

  /**
   * Calculate and store the charts of all metrics. Metrics are calculated one by one, never in parallel,
   * to prevent heavy load on the database. Returns counts, variation timings and errors for the task history.
   */
  async generateAllCharts() {
    const start = Date.now();
    const metrics: MetricGenerationResult[] = [];
    const channels = await this.connection.rawConnection
      .getRepository(Channel)
      .find({ relations: ['defaultTaxZone'] });
    const defaultChannel = await this.channelService.getDefaultChannel();
    for (const metric of this.options.metrics) {
      const channelsForMetric = metric.perChannel ? channels : [defaultChannel];
      for (const channel of channelsForMetric) {
        const ctx = await this.requestContextService.create({
          apiType: 'admin',
          channelOrToken: channel,
        });
        metrics.push(await this.generateCharts(ctx, metric));
      }
    }
    const chartsGenerated = metrics.reduce(
      (total, metric) =>
        total + metric.variations.filter((v) => v.success).length,
      0,
    );
    const durationMs = Date.now() - start;
    Logger.info(
      `Generated ${chartsGenerated} charts for ${this.options.metrics.length} metrics in ${durationMs}ms`,
      loggerCtx,
    );
    return { chartsGenerated, durationMs, metrics };
  }

  /**
   * Load and store the charts for all variations of a metric in the given channel.
   */
  private async generateCharts(
    ctx: RequestContext,
    metric: MetricDefinition,
  ): Promise<MetricGenerationResult> {
    const result: MetricGenerationResult = {
      code: metric.code,
      channel: metric.perChannel ? ctx.channel.code : null,
      variations: [],
    };
    const channelId = metric.perChannel ? String(ctx.channelId) : null;
    let variations: Array<string | undefined>;
    try {
      variations = metric.getChartVariations
        ? await metric.getChartVariations(ctx, this.injector)
        : [undefined];
    } catch (e) {
      const error = asError(e);
      Logger.error(
        `Failed to get variations for metric '${metric.code}' in channel '${ctx.channel.code}': ${error.message}`,
        loggerCtx,
        error.stack,
      );
      result.error = error.message;
      return result;
    }
    // Load variations one by one, recording calculation and persistence time.
    for (const [position, variation] of variations.entries()) {
      const start = Date.now();
      const variationResult: MetricGenerationResult['variations'][number] = {
        variation: variation ?? null,
        durationMs: 0,
        success: false,
      };
      try {
        const chart = validateMetricChart(
          await metric.loadChart(ctx, this.injector, variation),
        );
        await this.saveResult(ctx, {
          code: metric.code,
          variation: variation ?? null,
          channelId,
          position,
          chart,
        });
        variationResult.success = true;
      } catch (e) {
        const error = asError(e);
        Logger.error(
          `Failed to load chart for metric '${metric.code}' (variation '${variation}') in channel '${ctx.channel.code}': ${error.message}`,
          loggerCtx,
          error.stack,
        );
        variationResult.error = error.message;
      }
      variationResult.durationMs = Date.now() - start;
      result.variations.push(variationResult);
    }
    await this.removeStaleVariations(ctx, metric.code, channelId, variations);
    return result;
  }

  /**
   * Create or overwrite the stored chart for the given metric, variation and channel
   */
  private async saveResult(
    ctx: RequestContext,
    result: Pick<
      MetricResult,
      'code' | 'variation' | 'channelId' | 'position' | 'chart'
    >,
  ): Promise<void> {
    const repository = this.connection.getRepository(ctx, MetricResult);
    const existing = await repository.findOne({
      where: {
        code: result.code,
        variation: result.variation ?? IsNull(),
        channelId: result.channelId ?? IsNull(),
      },
    });
    await repository.save({ ...existing, ...result });
  }

  /**
   * Remove stored charts of variations that the metric no longer returns,
   * for example when the top 5 products have changed.
   */
  private async removeStaleVariations(
    ctx: RequestContext,
    code: string,
    channelId: string | null,
    variations: Array<string | undefined>,
  ): Promise<void> {
    const repository = this.connection.getRepository(ctx, MetricResult);
    const stored = await repository.find({
      where: { code, channelId: channelId ?? IsNull() },
    });
    const stale = stored.filter(
      (r) => !variations.includes(r.variation ?? undefined),
    );
    if (stale.length) {
      await repository.remove(stale);
    }
  }
}
