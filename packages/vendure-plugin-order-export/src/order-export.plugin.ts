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
import { OrderExportStrategy } from './api/order-export-strategy';
import { OrderExportService } from './api/order-export.service';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { OrderExportResultEntity } from './api/order-export-result.entity';
import { OrderExportConfigEntity } from './api/order-export-config.entity';

export interface OrderExportPluginConfig {
  strategies: OrderExportStrategy[];
}

@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [OrderExportResultEntity, OrderExportConfigEntity],
  providers: [
    OrderExportService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => OrderExportPlugin.config,
    },
  ],
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
  static config: OrderExportPluginConfig;

  static init(config: OrderExportPluginConfig): typeof OrderExportPlugin {
    this.config = config;
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
