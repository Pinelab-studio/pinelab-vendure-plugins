import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import path from 'path';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import {
  OrderExportController,
  OrderExportResolver,
  orderExportPermission,
} from './api/order-export.controller';
import { DefaultExportStrategy } from './index';
import { ExportStrategy } from './api/export-strategy';
import { PLUGIN_INIT_OPTIONS } from './constants';
import gql from 'graphql-tag';

export interface ExportPluginConfig {
  exportStrategies: ExportStrategy[];
}

@VendurePlugin({
  imports: [PluginCommonModule],
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
    return this;
  }

  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    ngModules: [
      {
        type: 'lazy',
        route: 'export-orders',
        ngModuleFileName: 'order-export.module.ts',
        ngModuleName: 'OrderExportModule',
      },
      {
        type: 'shared',
        ngModuleFileName: 'order-export-nav.module.ts',
        ngModuleName: 'OrderExportNavModule',
      },
    ],
  };
}
