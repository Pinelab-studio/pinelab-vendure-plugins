import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { ShipmateService } from './api/shipmate.service';
import { HttpModule } from '@nestjs/axios';
import { ShipmateConfigEntity } from './api/shipmate-config.entity';
import { ShipmateConfigService } from './api/shipmate-config.service';
import {
  ShipmateAdminResolver,
  adminSchema,
  shipmatePermission,
} from './api/shipmate.admin.graphql';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { ShipmateController } from './api/shipmate.controller';

export interface ShipmatePluginConfig {
  shipmateApiUrl: string;
}

@VendurePlugin({
  imports: [PluginCommonModule, HttpModule],
  controllers: [ShipmateController],
  providers: [
    ShipmateService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => VendureShipmatePlugin.config,
    },
    ShipmateConfigService,
  ],
  entities: [ShipmateConfigEntity],
  configuration: (config) => {
    config.authOptions.customPermissions.push(shipmatePermission);
    config.customFields.Order.push({
      name: 'shipmateReference',
      type: 'string',
      nullable: true,
      readonly: true,
    });
    return config;
  },
  adminApiExtensions: {
    schema: adminSchema,
    resolvers: [ShipmateAdminResolver],
  },
})
export class VendureShipmatePlugin {
  static config: ShipmatePluginConfig;
  static init(config: ShipmatePluginConfig): typeof VendureShipmatePlugin {
    this.config = config;
    return VendureShipmatePlugin;
  }
  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    routes: [{ filePath: 'routes.ts', route: 'shipmate-config' }],
    providers: ['providers.ts'],
  };
}
