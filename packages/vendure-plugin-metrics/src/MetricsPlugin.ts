import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import path from 'path';
import { schema } from './api/schema.graphql';
import { MetricsResolver } from './api/metrics.resolver';
import { MetricsService } from './api/metrics.service';
import {
  averageOrderValueMetric,
  defaultDataLoader,
  MetricCalculation,
  MetricDataLoaderFunction,
} from './api/strategies';
import { PLUGIN_INIT_OPTIONS } from './constants';

export interface MetricsPluginOptions {
  dataLoader: MetricDataLoaderFunction<any>;
  metricCalculations: MetricCalculation<any>[];
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
    dataLoader: defaultDataLoader,
    metricCalculations: [averageOrderValueMetric],
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
