import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { MinisearchEngine } from './config/minisearch-engine';
import { adminApiExtensions, shopApiExtensions } from './api/api-extensions';
import { SearchAdminResolver } from './api/search-admin.resolver';
import { SearchShopResolver } from './api/search.resolver';
import { BETTER_SEARCH_PLUGIN_OPTIONS } from './constants';
import { SearchService } from './services/search.service';
import { BetterSearchOptions } from './types';
import { IndexService } from './services/index.service';
import { BetterSearchIndex } from './entities/better-search-index.entity';
import { betterSearchReindexTask } from './config/reindex-task';
import { betterSearchLogCleanupTask } from './config/search-log-cleanup-task';
import { BetterSearchLog } from './entities/better-search-log.entity';
import { SearchLogService } from './services/search-log.service';
import { SearchLogAggregationService } from './services/search-log-aggregation.service';
import { SearchLogResolver } from './api/search-log.resolver';

@VendurePlugin({
  imports: [PluginCommonModule],
  exports: [IndexService],
  providers: [
    {
      provide: BETTER_SEARCH_PLUGIN_OPTIONS,
      useFactory: () => BetterSearchPlugin.options,
    },
    SearchService,
    SearchLogService,
    SearchLogAggregationService,
    IndexService,
  ],
  configuration: (config) => {
    config.schedulerOptions.tasks.push(
      betterSearchLogCleanupTask,
      betterSearchReindexTask.configure({
        schedule:
          BetterSearchPlugin.options.reindexSchedule ??
          ((cron) => cron.everyDayAt(4, 0)),
      })
    );
    return config;
  },
  compatibility: '^3.0.0',
  dashboard: './dashboard/index.tsx',
  shopApiExtensions: {
    schema: shopApiExtensions,
    resolvers: [SearchShopResolver],
  },
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [SearchAdminResolver, SearchLogResolver],
  },
  entities: [BetterSearchIndex, BetterSearchLog],
})
export class BetterSearchPlugin {
  static options: BetterSearchOptions;

  /** Configures search and validates the per-channel search log limit. */
  static init(options: BetterSearchOptions): Type<BetterSearchPlugin> {
    const searchLogAggregationCacheTtlSeconds =
      options.searchLogAggregationCacheTtlSeconds ?? 60;
    if (
      !Number.isFinite(searchLogAggregationCacheTtlSeconds) ||
      !Number.isInteger(searchLogAggregationCacheTtlSeconds) ||
      searchLogAggregationCacheTtlSeconds < 0
    ) {
      throw new Error(
        'searchLogAggregationCacheTtlSeconds must be a finite non-negative integer'
      );
    }
    const maxLogsPerChannel = options.maxLogsPerChannel ?? 10_000;
    if (
      maxLogsPerChannel !== false &&
      (!Number.isFinite(maxLogsPerChannel) ||
        !Number.isInteger(maxLogsPerChannel) ||
        maxLogsPerChannel < 0)
    ) {
      throw new Error(
        'maxLogsPerChannel must be a finite non-negative integer or false'
      );
    }
    this.options = {
      ...options,
      maxLogsPerChannel,
      searchLogAggregationCacheTtlSeconds,
      searchEngine: options.searchEngine ?? new MinisearchEngine(),
    };
    return BetterSearchPlugin;
  }
}
