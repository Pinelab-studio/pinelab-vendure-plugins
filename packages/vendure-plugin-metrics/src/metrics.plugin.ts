import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import path from 'path';
import { schema } from './api/schema.graphql';
import { MetricsResolver } from './api/metrics.resolver';
import { MetricsService } from './api/metrics.service';
import { MetricStrategy } from './api/metric-strategy';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { RevenuePerProduct } from './api/metrics/revenue-per-product';
import { AverageOrderValueMetric } from './api/metrics/average-order-value';
import { UnitsSoldMetric } from './api/metrics/units-sold-metric';

export interface MetricsPluginOptions {
  /**
   * The enabled metrics shown in the widget.
   */
  metrics: MetricStrategy<any>[];
  /**
   * The number of past months to display in the metrics widget.
   * If your shop has a lot of orders, consider using only the last 3 months for example.
   */
  displayPastMonths: number;
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
    metrics: [
      new RevenuePerProduct(),
      new AverageOrderValueMetric(),
      new UnitsSoldMetric(),
    ],
    displayPastMonths: 13,
  };

  static init(options: Partial<MetricsPluginOptions>): typeof MetricsPlugin {
    this.options = {
      ...this.options,
      ...options,
    };
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
