import {
  PluginCommonModule,
  RuntimeVendureConfig,
  Type,
  VendurePlugin,
} from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { InvoiceConfigEntity } from './api/invoice-config.entity';
import { PinelabPluginAdminComponentsService } from './api/pinelab-plugin-admin-components.service';
import {
  PinelabPluginAdminComponentsResolver,
  pinelabPluginComponetsPermission,
} from './api/pinelab-plugin-admin-components.resolver';
import { schema } from './api/schema.graphql';
import { DataStrategy } from './api/strategies/data-strategy';
import { DefaultDataStrategy } from './api/strategies/default-data-strategy';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { PinelabPluginAdminComponentsController } from './api/pinelab-plugin-admin-components.controller';

export interface PinelabAdminComponentsPluginConfig {
  dataStrategy: DataStrategy;
}
@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [InvoiceConfigEntity],
  providers: [
    PinelabPluginAdminComponentsService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => PinelabAdminComponentsPlugin.config,
    },
  ],
  controllers: [PinelabPluginAdminComponentsController],
  adminApiExtensions: {
    schema: schema as any,
    resolvers: [PinelabPluginAdminComponentsResolver],
  },
  configuration: (config: RuntimeVendureConfig) => {
    config.authOptions.customPermissions.push(pinelabPluginComponetsPermission);
    return config;
  },
})
export class PinelabAdminComponentsPlugin {
  static config: PinelabAdminComponentsPluginConfig;

  static init(
    config?: PinelabAdminComponentsPluginConfig
  ): Type<PinelabAdminComponentsPlugin> {
    PinelabAdminComponentsPlugin.config = {
      ...config,
      dataStrategy: config?.dataStrategy || new DefaultDataStrategy(),
    };
    return this;
  }

  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    ngModules: [
      {
        type: 'lazy',
        route: 'invoices',
        ngModuleFileName: 'pinelab-plugin-admin-components.module.ts',
        ngModuleName: 'PinelabPluinAdminComponentsModule',
      },
      {
        type: 'shared',
        ngModuleFileName: 'pinelab-plugin-admin-components.nav.module.ts',
        ngModuleName: 'PinelabPluginAdminComponentsNavModule',
      },
    ],
  };
}
