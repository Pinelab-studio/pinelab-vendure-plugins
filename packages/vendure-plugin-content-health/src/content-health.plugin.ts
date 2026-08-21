import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { adminApiExtensions } from './api/api-extensions';
import { ContentHealthResolver } from './api/content-health.resolver';
import { buildContentHealthScanTask } from './config/content-health-scheduled-task';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { ContentCheckResult } from './entities/content-check-result.entity';
import { ContentCheckResultService } from './services/content-check-result.service';
import { ContentCheckService } from './services/content-check.service';
import { SitemapFetcher } from './services/sitemap-fetcher';
import { StorefrontPageFetcher } from './services/storefront-page-fetcher';
import { ContentHealthPluginOptions } from './types';

/**
 * @description
 * Validates both Vendure catalog data and the actual rendered storefront
 * output for products and collections, per channel and per enabled
 * language, and surfaces the results in the Vendure Dashboard.
 *
 * Requires a `getStorefrontUrl` resolver at minimum; see the README for
 * full configuration options.
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [ContentCheckResult],
  providers: [
    ContentCheckService,
    ContentCheckResultService,
    StorefrontPageFetcher,
    SitemapFetcher,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => ContentHealthPlugin.options,
    },
  ],
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [ContentHealthResolver],
  },
  configuration: (config) => {
    config.schedulerOptions.tasks.push(
      buildContentHealthScanTask(ContentHealthPlugin.options?.scheduledTask)
    );
    return config;
  },
  dashboard: './dashboard/index.tsx',
  compatibility: '>=3.3.0',
})
export class ContentHealthPlugin {
  static options: ContentHealthPluginOptions;

  static init(options: ContentHealthPluginOptions): typeof ContentHealthPlugin {
    this.options = options;
    return ContentHealthPlugin;
  }
}
