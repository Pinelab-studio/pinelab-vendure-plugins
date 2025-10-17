import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { gql } from 'graphql-tag';
import { StockMonitoringResolver } from './api/stock-monitoring.resolver';
import { StockMonitoringPluginOptions } from './types';
import { StockMonitoringService } from './services/stock-monitoring.service';
import { apiExtensions } from './api/api-extensions';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { customVariantFields } from './custom-fields';

@VendurePlugin({
  imports: [PluginCommonModule],
  adminApiExtensions: {
    schema: apiExtensions.schema,
    resolvers: [StockMonitoringResolver],
  },
  providers: [
    StockMonitoringService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => StockMonitoringPlugin.options,
    },
  ],
  configuration: (config) => {
    config.customFields.ProductVariant.push(...customVariantFields);
    return config;
  },
  compatibility: '>=3.0.0',
})
export class StockMonitoringPlugin {
  static options: StockMonitoringPluginOptions;

  static init(
    options: StockMonitoringPluginOptions
  ): typeof StockMonitoringPlugin {
    this.options = options;
    return StockMonitoringPlugin;
  }

  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    providers: ['providers.ts'],
  };
}
