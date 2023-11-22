import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { gql } from 'graphql-tag';
import { StockMonitoringResolver } from './api/stock-monitoring.resolver';

export * from './api/low-stock.email-handler';

export interface StockMonitoringPlugin {
  /**
   * Widget will show productvariants with a stocklevel below 'threshold'
   */
  threshold: number;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  adminApiExtensions: {
    schema: gql`
      extend type Query {
        productVariantsWithLowStock: [ProductVariant!]!
      }
    `,
    resolvers: [StockMonitoringResolver],
  },
  compatibility: '^2.0.0',
})
export class StockMonitoringPlugin {
  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    providers: ['providers.ts'],
  };
  static threshold = 10;
  static init(options: StockMonitoringPlugin): typeof StockMonitoringPlugin {
    this.threshold = options.threshold;
    return StockMonitoringPlugin;
  }
}
