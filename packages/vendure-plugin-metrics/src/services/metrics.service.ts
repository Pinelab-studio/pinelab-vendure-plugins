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
import type { MetricStrategy, MetricsPluginOptions } from '../types';
import { validateMetricChart } from './util';

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
    const strategy = this.options.metrics.find((m) => m.code === code);
    if (!strategy) {
      // Results of metrics that are no longer configured are hidden
      return [];
    }
    return await this.connection.getRepository(ctx, MetricResult).find({
      where: {
        code,
        channelId: strategy.perChannel ? String(ctx.channelId) : IsNull(),
      },
      order: { position: 'ASC' },
    });
  }

  /**
   * Calculate and store the charts of all metrics. Strategies run one by one, never in parallel,
   * to prevent heavy load on the database. A failing strategy is logged and keeps its previous charts.
   */
  async generateAllCharts(): Promise<void> {
    const channels = await this.connection.rawConnection
      .getRepository(Channel)
      .find();
    const defaultChannel = await this.channelService.getDefaultChannel();
    const start = Date.now();
    for (const strategy of this.options.metrics) {
      const channelsForStrategy = strategy.perChannel
        ? channels
        : [defaultChannel];
      for (const channel of channelsForStrategy) {
        const ctx = await this.requestContextService.create({
          apiType: 'admin',
          channelOrToken: channel,
        });
        await this.generateCharts(ctx, strategy);
      }
    }
    Logger.info(
      `Generated charts for ${this.options.metrics.length} metrics in ${Date.now() - start}ms`,
      loggerCtx,
    );
  }

  /**
   * Load and store the charts for all variations of a strategy in the given channel.
   */
  private async generateCharts(
    ctx: RequestContext,
    strategy: MetricStrategy,
  ): Promise<void> {
    const channelId = strategy.perChannel ? String(ctx.channelId) : null;
    let variations: Array<string | undefined>;
    try {
      variations = strategy.getChartVariations
        ? await strategy.getChartVariations(ctx, this.injector)
        : [undefined];
    } catch (e) {
      const error = asError(e);
      Logger.error(
        `Failed to get variations for metric '${strategy.code}' in channel '${ctx.channel.code}': ${error.message}`,
        loggerCtx,
        error.stack,
      );
      return;
    }
    // Load variations one by one
    for (const [position, variation] of variations.entries()) {
      try {
        const chart = validateMetricChart(
          await strategy.loadChart(ctx, this.injector, variation),
        );
        await this.saveResult(ctx, {
          code: strategy.code,
          variation: variation ?? null,
          channelId,
          position,
          chart,
        });
      } catch (e) {
        const error = asError(e);
        Logger.error(
          `Failed to load chart for metric '${strategy.code}' (variation '${variation}') in channel '${ctx.channel.code}': ${error.message}`,
          loggerCtx,
          error.stack,
        );
      }
    }
    await this.removeStaleVariations(ctx, strategy.code, channelId, variations);
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
   * Remove stored charts of variations that the strategy no longer returns,
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
