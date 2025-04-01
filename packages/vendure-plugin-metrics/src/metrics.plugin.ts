import { OnApplicationBootstrap } from '@nestjs/common';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import path from 'path';
import { schema } from './api/schema.graphql';
import { MetricsResolver } from './api/metrics.resolver';
import { MetricsService } from './services/metrics.service';
import { MetricStrategy } from './services/metric-strategy';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { RevenuePerProduct } from './metrics/revenue-per-product';
import { AverageOrderValueMetric } from './metrics/average-order-value';
import { UnitsSoldMetric } from './metrics/units-sold-metric';
import { MetricSummary } from './entities/metric-summary.entity';
import { MetricRequest } from './entities/metric-request.entity';
import { RequestService, shouldLogRequest } from './services/request-service';
import { Request } from 'express';
import { RequestMiddleware } from './services/reques-middleware';
import { MetricRequestSalt } from './entities/metric-request-salt';
import { ConversionMetric } from './metrics/conversion-metric';
import { VisitorsMetric } from './metrics/visitors-metric';

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
  /**
   * Optional: decide wether to log a request or not.
   * The default strategy only logs shop-api requests,
   * and attempts to exclude any non-human traffic based on user agent.
   */
  shouldLogRequest: (request: Request) => boolean;
  /**
   * Use to aggregate visits: multiple requests from the same user
   * within a certain time frame are grouped into a single visit.
   * The default is 30 minutes.
   */
  sessionLengthInMinutes: number;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  adminApiExtensions: {
    schema,
    resolvers: [MetricsResolver],
  },
  providers: [
    MetricsService,
    RequestService,
    RequestMiddleware,
    { provide: PLUGIN_INIT_OPTIONS, useFactory: () => MetricsPlugin.options },
  ],
  compatibility: '>=2.2.0',
  entities: [MetricSummary, MetricRequest, MetricRequestSalt],
  configuration: (config) => {
    config.apiOptions.middleware.push({
      route: 'shop-api',
      handler: RequestMiddleware,
      beforeListen: true,
    });
    return config;
  },
})
export class MetricsPlugin {
  static options: MetricsPluginOptions = {
    metrics: [
      new RevenuePerProduct(),
      new ConversionMetric(),
      new VisitorsMetric(),
      new AverageOrderValueMetric(),
      new UnitsSoldMetric(),
    ],
    displayPastMonths: 13,
    shouldLogRequest: shouldLogRequest,
    sessionLengthInMinutes: 30,
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
