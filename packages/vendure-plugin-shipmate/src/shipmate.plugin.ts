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

@VendurePlugin({
  imports: [PluginCommonModule, HttpModule],
  providers: [ShipmateService, ShipmateConfigService],
  entities: [ShipmateConfigEntity],
  configuration: (config) => {
    config.authOptions.customPermissions.push(shipmatePermission);
    return config;
  },
  adminApiExtensions: {
    schema: adminSchema,
    resolvers: [ShipmateAdminResolver],
  },
})
export class VendureShipmatePlugin {
  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    routes: [{ filePath: 'routes.ts', route: 'shipmate-config' }],
    providers: ['providers.ts'],
  };
}
