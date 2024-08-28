import {
  LanguageCode,
  PluginCommonModule,
  RuntimeVendureConfig,
  Type,
  VendurePlugin,
} from '@vendure/core';
import { PrimaryCollectionPluginResolver } from './api/primary-collection.resolver';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { PrimaryCollectionHelperService } from './api/primary-collections-helper.service';
import { apiExtensions } from './api/api-extensions';

export interface PrimaryCollectionPluginConfig {
  /**
   * This specifies the admin ui tab name under which the collection dropdown appears
   */
  customFieldUITabName?: string;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [PrimaryCollectionHelperService],
  shopApiExtensions: {
    schema: apiExtensions,
    resolvers: [PrimaryCollectionPluginResolver],
  },
  adminApiExtensions: {
    schema: apiExtensions,
    resolvers: [PrimaryCollectionPluginResolver],
  },
  exports: [PrimaryCollectionHelperService],
  compatibility: '>=2.2.0',
  configuration: (config: RuntimeVendureConfig) => {
    config.customFields.Product.push({
      name: 'primaryCollection',
      type: 'string',
      ui: {
        component: 'select-primary-collection',
        tab: PrimaryCollectionPlugin?.config?.customFieldUITabName,
      },
      label: [{ languageCode: LanguageCode.en, value: 'Primary Collection' }],
    });
    return config;
  },
})
export class PrimaryCollectionPlugin {
  static config: PrimaryCollectionPluginConfig;
  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    ngModules: [
      {
        type: 'shared',
        ngModuleFileName: 'shared.module.ts',
        ngModuleName: 'PrimaryCollectionSharedExtensionModule',
      },
    ],
  };

  static init(
    config: PrimaryCollectionPluginConfig
  ): Type<PrimaryCollectionPlugin> {
    this.config = config;
    return this;
  }
}
