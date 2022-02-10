import {
  PluginCommonModule,
  RuntimeVendureConfig,
  VendurePlugin,
} from '@vendure/core';
import path from 'path';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import { orderExportPermission } from './index';
import { OrderExportResolver } from './api/order-export.resolver';
import { schema } from './api/schema.graphql';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [],
  adminApiExtensions: {
    resolvers: [OrderExportResolver],
    schema,
  },
  configuration: (config: RuntimeVendureConfig) => {
    config.authOptions.customPermissions.push(orderExportPermission);
    return config;
  },
})
export class OrderExportPlugin {
  static init(): typeof OrderExportPlugin {
    return OrderExportPlugin;
  }

  static getUIExtension(): AdminUiExtension {
    return {
      extensionPath: path.join(__dirname, 'ui'),
      ngModules: [
        {
          type: 'lazy',
          route: 'order-export',
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
}
