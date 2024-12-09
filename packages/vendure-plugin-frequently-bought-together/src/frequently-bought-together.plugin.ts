import {
  LanguageCode,
  PluginCommonModule,
  Product,
  Type,
  VendurePlugin,
} from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';

import { FREQUENTLY_BOUGHT_TOGETHER_PLUGIN_OPTIONS } from './constants';
import { FrequentlyBoughtTogetherService } from './services/frequently-bought-together.service';
import { PluginInitOptions } from './types';
import path from 'path';
import { adminApiExtensions } from './api/api-extensions';
import { FrequentlyBoughtTogetherAdminResolver } from './api/frequently-bought-together-admin.resolver';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: FREQUENTLY_BOUGHT_TOGETHER_PLUGIN_OPTIONS,
      useFactory: () => FrequentlyBoughtTogetherPlugin.options,
    },
    FrequentlyBoughtTogetherService,
  ],
  configuration: (config) => {
    config.customFields.Product.push({
      name: 'frequentlyBoughtWith',
      type: 'relation',
      label: [
        { languageCode: LanguageCode.en, value: 'Frequently bought with' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value:
            'Products which are frequently bought together with these products',
        },
      ],
      list: true,
      entity: Product,
      public: true,
      readonly: false,
      eager: false,
      nullable: true,
      ui: { tab: FrequentlyBoughtTogetherPlugin.options.customFieldUiTab },
    });
    return config;
  },
  compatibility: '>=2.2.0',
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [FrequentlyBoughtTogetherAdminResolver],
  },
})
export class FrequentlyBoughtTogetherPlugin {
  static options: PluginInitOptions = {
    maxRelatedProducts: 5,
    customFieldUiTab: 'Related products',
    experimentMode: false,
    supportLevel: 0.01,
  };

  static init(
    options: Partial<PluginInitOptions>
  ): Type<FrequentlyBoughtTogetherPlugin> {
    this.options = {
      ...this.options,
      ...options,
    };
    return FrequentlyBoughtTogetherPlugin;
  }

  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    providers: ['providers.ts'],
  };
}
