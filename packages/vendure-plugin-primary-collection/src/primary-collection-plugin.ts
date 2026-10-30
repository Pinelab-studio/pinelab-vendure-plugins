import {
  LanguageCode,
  PluginCommonModule,
  type RuntimeVendureConfig,
  type Type,
  VendurePlugin,
} from '@vendure/core';
import { apiExtensions } from './api/api-extensions';
import { PrimaryCollectionPluginResolver } from './api/primary-collection.resolver';
import { PrimaryCollectionHelperService } from './api/primary-collections-helper.service';

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
      label: [{ languageCode: LanguageCode.en, value: 'Primary Collection' }],
    });
    return config;
  },
})
export class PrimaryCollectionPlugin {
  static config: PrimaryCollectionPluginConfig;
  static init(
    config: PrimaryCollectionPluginConfig,
  ): Type<PrimaryCollectionPlugin> {
    PrimaryCollectionPlugin.config = config;
    return PrimaryCollectionPlugin;
  }
}
