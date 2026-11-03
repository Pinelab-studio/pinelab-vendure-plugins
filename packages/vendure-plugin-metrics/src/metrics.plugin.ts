import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { Kind } from 'graphql';
import { adminApiExtensions, createMetricCodeEnum } from './api/api-extensions';
import { MetricsAdminResolver } from './api/metrics.admin-resolver';
import { defaultMetrics } from './config/built-in-metrics';
import { buildMetricsScheduledTask } from './config/metrics-scheduled-task';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { MetricResult } from './entities/metric-result.entity';
import { MetricsService } from './services/metrics.service';
import type { MetricsPluginOptions } from './types';

/**
 * Calculates metrics nightly and shows them as charts in the React dashboard.
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  adminApiExtensions: {
    schema: () => ({
      kind: Kind.DOCUMENT,
      definitions: [
        ...adminApiExtensions.definitions,
        ...createMetricCodeEnum(
          MetricsPlugin.options.metrics.map((m) => m.code),
        ).definitions,
      ],
    }),
    resolvers: [MetricsAdminResolver],
  },
  providers: [
    MetricsService,
    { provide: PLUGIN_INIT_OPTIONS, useFactory: () => MetricsPlugin.options },
  ],
  entities: [MetricResult],
  configuration: (config) => {
    config.schedulerOptions.tasks.push(
      buildMetricsScheduledTask(MetricsPlugin.options.scheduledTask),
    );
    return config;
  },
  dashboard: './dashboard/index.tsx',
  compatibility: '>=3.3.0',
})
export class MetricsPlugin {
  static options: MetricsPluginOptions = {
    metrics: defaultMetrics,
  };

  /**
   * Configure the plugin. Throws when metric codes are missing, duplicated or not valid GraphQL enum values.
   */
  static init(options: Partial<MetricsPluginOptions>): typeof MetricsPlugin {
    const metrics = options.metrics ?? defaultMetrics;
    if (!metrics.length) {
      throw Error(`MetricsPlugin: at least one metric is required`);
    }
    const codes = metrics.map((m) => m.code);
    const invalid = codes.find((c) => !/^[_A-Za-z][_0-9A-Za-z]*$/.test(c));
    if (invalid) {
      throw Error(
        `MetricsPlugin: metric code '${invalid}' must be a valid GraphQL enum value, like 'units_sold'`,
      );
    }
    const duplicate = codes.find((c, i) => codes.indexOf(c) !== i);
    if (duplicate) {
      throw Error(`MetricsPlugin: metric code '${duplicate}' is not unique`);
    }
    MetricsPlugin.options = { ...MetricsPlugin.options, ...options, metrics };
    return MetricsPlugin;
  }
}
