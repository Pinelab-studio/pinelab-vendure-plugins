import {
  PluginCommonModule,
  RuntimeVendureConfig,
  VendurePlugin,
} from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { PicklistConfigEntity } from './api/picklist-config.entity';
import { PicklistService } from './api/picklist.service';
import { PicklistResolver, picklistPermission } from './api/picklist.resolver';
import { schema } from './api/schema.graphql';
import { PicklistController } from './api/picklist.controller';

@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [PicklistConfigEntity],
  providers: [PicklistService],
  controllers: [PicklistController],
  adminApiExtensions: {
    schema: schema as any,
    resolvers: [PicklistResolver],
  },
  configuration: (config: RuntimeVendureConfig) => {
    config.authOptions.customPermissions.push(picklistPermission);
    return config;
  },
})
export class PicklistPlugin {
  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    ngModules: [
      {
        type: 'lazy',
        route: 'picklists',
        ngModuleFileName: 'picklist.module.ts',
        ngModuleName: 'PicklistModule',
      },
      {
        type: 'shared',
        ngModuleFileName: 'picklist.nav.module.ts',
        ngModuleName: 'PicklistNavModule',
      },
    ],
  };
}
