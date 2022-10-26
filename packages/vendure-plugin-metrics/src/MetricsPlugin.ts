import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import path from 'path';
import { schema } from './api/schema.graphql';
import { MetricsResolver } from './api/metrics.resolver';
import { MetricsService } from './api/metrics.service';
import {
  AverageOrderValueMetric,
  ConversionRateMetric,
  MetricCalculation,
  NrOfOrdersMetric,
} from './api/strategies';
import { PLUGIN_INIT_OPTIONS } from './constants';

export interface MetricsPluginOptions {
  metrics: MetricCalculation[];
  /**
   * Relations to fetch for orders.
   * Getting many orders with many relation can be heavy on the DB,
   * so handle with care
   */
  orderRelations?: string[];
}

@VendurePlugin({
  imports: [PluginCommonModule],
  adminApiExtensions: {
    schema,
    resolvers: [MetricsResolver],
  },
  providers: [
    MetricsService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => MetricsPlugin.options,
    },
  ],
})
export class MetricsPlugin {
  static options: MetricsPluginOptions = {
    metrics: [
      new ConversionRateMetric(),
      new AverageOrderValueMetric(),
      new NrOfOrdersMetric(),
    ],
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
