import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { concatAST } from 'graphql';
import { adminApiExtensions } from './api/api-extensions';
import { ContentAutomationResolver } from './api/content-automation.resolver';
import { contentAutomationTask } from './config/content-automation-scheduled-task';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { ContentAutomationUpdate } from './entities/content-automation-update.entity';
import { adminApiExtensions as contentHealthApiExtensions } from './health/api/api-extensions';
import { ContentHealthResolver } from './health/api/content-health.resolver';
import { buildContentHealthScanTask } from './health/config/content-health-scheduled-task';
import { CONTENT_HEALTH_OPTIONS } from './health/constants';
import { ContentCheckResult } from './health/entities/content-check-result.entity';
import { ContentCheckService } from './health/services/content-check.service';
import { ContentCheckResultService } from './health/services/content-check-result.service';
import { SitemapFetcher } from './health/services/sitemap-fetcher';
import { StorefrontPageFetcher } from './health/services/storefront-page-fetcher';
import { ContentAutomationService } from './services/content-automation.service';
import { findDuplicates } from './services/util';
import { ContentAutomationPluginOptions } from './types';

/**
 * @description
 * Generates and checks entity content, per channel and language. Both features are optional:
 *
 * - **Content automation** (`automationStrategies`): bulk generation/enrichment of entity content
 *   through consumer-provided strategies. The plugin ships no content logic: see `ContentAutomationStrategy`.
 * - **Content health** (`contentHealth`): validates Vendure catalog data and the rendered storefront
 *   output of products and collections, and shows the findings in the Dashboard. See `ContentHealthPluginOptions`.
 *
 * A disabled feature registers no Admin API or scheduled task. Dashboard UI remains visible.
 * The nightly health scan (03:00) runs after the automation task (02:00), but doesn't wait for
 * automation jobs to finish. Product and collection updates, including those saved by automation
 * strategies, still trigger an immediate health check.
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  // Always registered, so the database schema and stored data don't depend on which features are enabled
  entities: [ContentAutomationUpdate, ContentCheckResult],
  providers: [
    ContentAutomationService,
    ContentCheckService,
    ContentCheckResultService,
    StorefrontPageFetcher,
    SitemapFetcher,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => ContentAutomationPlugin.options,
    },
    {
      provide: CONTENT_HEALTH_OPTIONS,
      useFactory: () => ContentAutomationPlugin.options.contentHealth,
    },
  ],
  // A disabled feature registers no API or scheduled task
  adminApiExtensions: {
    schema: () => {
      const schemas = enabledFeatures().map((f) => f.schema);
      return schemas.length ? concatAST(schemas) : undefined;
    },
    resolvers: () => enabledFeatures().map((f) => f.resolver),
  },
  configuration: (config) => {
    const features = enabledFeatures();
    config.schedulerOptions.tasks.push(
      ...features.flatMap((f) => (f.scheduledTask ? [f.scheduledTask()] : [])),
    );
    return config;
  },
  dashboard: './dashboard/index.tsx',
  compatibility: '>=3.3.0',
})
export class ContentAutomationPlugin {
  static options: ContentAutomationPluginOptions = {};

  /**
   * Initializes the plugin. Each `init()` call replaces the previous options.
   * Throws if multiple automation strategies have the same name.
   */
  static init(
    options: ContentAutomationPluginOptions,
  ): Type<ContentAutomationPlugin> {
    const duplicates = findDuplicates(
      (options.automationStrategies ?? []).map((s) => s.name),
    );
    if (duplicates.length) {
      throw new Error(
        `Content automation strategy names must be unique. Duplicates: ${duplicates.join(
          ', ',
        )}`,
      );
    }
    ContentAutomationPlugin.options = options;
    return ContentAutomationPlugin;
  }
}

/**
 * The API and scheduled task of each feature that is enabled in the plugin options.
 * The scheduled task is created lazily, because the health task is configured from its options.
 */
function enabledFeatures() {
  const { automationStrategies, contentHealth, nightlyAutomation } =
    ContentAutomationPlugin.options;
  return [
    automationStrategies && {
      schema: adminApiExtensions,
      resolver: ContentAutomationResolver,
      // Undefined when nightly automation is turned off
      scheduledTask:
        nightlyAutomation === false ? undefined : () => contentAutomationTask,
    },
    contentHealth && {
      schema: contentHealthApiExtensions,
      resolver: ContentHealthResolver,
      scheduledTask: () =>
        buildContentHealthScanTask(contentHealth.scheduledTask),
    },
  ].filter((feature) => !!feature);
}
