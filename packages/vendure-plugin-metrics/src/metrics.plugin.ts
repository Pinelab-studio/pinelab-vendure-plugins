import { OnApplicationBootstrap } from '@nestjs/common';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import {
  PluginCommonModule,
  RequestContext,
  VendurePlugin,
} from '@vendure/core';
import path from 'path';
import { adminSchema, shopSchema } from './api/schema.graphql';
import { MetricsAdminResolver } from './api/metrics.admin-resolver';
import { MetricsService } from './services/metrics.service';
import { MetricStrategy } from './services/metric-strategy';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { RevenuePerProduct } from './metrics/revenue-per-product';
import { AverageOrderValueMetric } from './metrics/average-order-value';
import { UnitsSoldMetric } from './metrics/units-sold-metric';
import { MetricSummary } from './entities/metric-summary.entity';
export interface MetricsPluginOptions {
  /**
   * The enabled metrics shown in the widget.
   */
  metrics: MetricStrategy[];
  /**
   * The number of past months to display in the metrics widget.
   * If your shop has a lot of orders, consider using only the last 3 months for example.
   */
  displayPastMonths: number;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  adminApiExtensions: {
    schema: adminSchema,
    resolvers: [MetricsAdminResolver],
  },
  shopApiExtensions: {
    schema: shopSchema,
  },
  providers: [
    MetricsService,
    { provide: PLUGIN_INIT_OPTIONS, useFactory: () => MetricsPlugin.options },
  ],
  compatibility: '>=2.2.0',
  entities: [MetricSummary],
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
