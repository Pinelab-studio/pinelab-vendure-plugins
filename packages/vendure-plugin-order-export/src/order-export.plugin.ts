import { PluginCommonModule, type Type, VendurePlugin } from '@vendure/core';
import gql from 'graphql-tag';
import type { ExportStrategy } from './api/export-strategy';
import {
  OrderExportController,
  OrderExportResolver,
  orderExportPermission,
} from './api/order-export.controller';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { DefaultExportStrategy } from './index';

export interface ExportPluginConfig {
  exportStrategies: ExportStrategy[];
}

@VendurePlugin({
  imports: [PluginCommonModule],
  dashboard: './dashboard/index.tsx',
  providers: [
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => OrderExportPlugin.config,
    },
  ],
  adminApiExtensions: {
    resolvers: [OrderExportResolver],
    schema: gql`
      extend type Query {
        availableOrderExportStrategies: [String!]!
      }
    `,
  },
  controllers: [OrderExportController],
  configuration: (config) => {
    config.authOptions.customPermissions.push(orderExportPermission);
    return config;
  },
  compatibility: '>=2.2.0',
})
export class OrderExportPlugin {
  static config: ExportPluginConfig;

  static init(config: ExportPluginConfig): Type<OrderExportPlugin> {
    if (!config.exportStrategies?.length) {
      config.exportStrategies.push(new DefaultExportStrategy());
    }
    OrderExportPlugin.config = config;
    return OrderExportPlugin;
  }
}
