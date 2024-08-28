import {
  PluginCommonModule,
  RuntimeVendureConfig,
  Type,
  VendurePlugin,
} from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { PicklistConfigEntity } from './api/picklist-config.entity';
import { PicklistService } from './api/picklist.service';
import { PicklistResolver, picklistPermission } from './api/picklist.resolver';
import { schema } from './api/schema.graphql';
import { PicklistController } from './api/picklist.controller';
import { LoadDataFn, defaultLoadDataFn } from './load-data-fn';
import { PLUGIN_INIT_OPTIONS } from './constants';

export interface PicklistPluginConfig {
  /**
   * Load custom data that is passed in to your HTML/handlebars template
   */
  loadDataFn?: LoadDataFn;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [PicklistConfigEntity],
  providers: [
    PicklistService,
    { provide: PLUGIN_INIT_OPTIONS, useFactory: () => PicklistPlugin.config },
  ],
  controllers: [PicklistController],
  adminApiExtensions: {
    schema: schema as any,
    resolvers: [PicklistResolver],
  },
  configuration: (config: RuntimeVendureConfig) => {
    config.authOptions.customPermissions.push(picklistPermission);
    return config;
  },
  compatibility: '>=2.2.0',
})
export class PicklistPlugin {
  static config: PicklistPluginConfig;
  static init(config?: Partial<PicklistPluginConfig>): Type<PicklistPlugin> {
    PicklistPlugin.config = {
      loadDataFn: config?.loadDataFn || defaultLoadDataFn,
    };
    return this;
  }
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
