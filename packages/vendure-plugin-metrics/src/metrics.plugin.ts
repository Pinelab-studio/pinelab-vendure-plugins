import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import path from 'path';
import { schema } from './api/schema.graphql';
import { MetricsResolver } from './api/metrics.resolver';
import { MetricsService } from './api/metrics.service';
import { MetricStrategy } from './api/metric-strategy';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { SalesPerProductMetric } from './api/metrics/sales-per-product';
import { AverageOrderValueMetric } from './api/metrics/average-order-value';

export interface MetricsPluginOptions {
  metrics: MetricStrategy<any>[];
}

@VendurePlugin({
  imports: [PluginCommonModule],
  adminApiExtensions: {
    schema,
    resolvers: [MetricsResolver],
  },
  providers: [
    MetricsService,
    { provide: PLUGIN_INIT_OPTIONS, useFactory: () => MetricsPlugin.options },
  ],
  compatibility: '>=2.2.0',
})
export class MetricsPlugin {
  static options: MetricsPluginOptions = {
    metrics: [new SalesPerProductMetric(), new AverageOrderValueMetric()],
  };

  static init(options: MetricsPluginOptions): typeof MetricsPlugin {
    this.options = options;
    return MetricsPlugin;
  }

  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    ngModules: [
      {
        type: 'shared',
        ngModuleFileName: 'metrics-widget.shared-module.ts',
        ngModuleName: 'MetricsWidgetSharedModule',
      },
    ],
  };
}
