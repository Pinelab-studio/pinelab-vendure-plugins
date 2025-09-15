import {
  LanguageCode,
  PluginCommonModule,
  Product,
  Type,
  VendurePlugin,
} from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';

import path from 'path';
import { adminApiExtensions, shopApiExtensions } from './api/api-extensions';
import { FrequentlyBoughtTogetherAdminResolver } from './api/frequently-bought-together-admin.resolver';
import { FrequentlyBoughtTogetherShopResolver } from './api/frequently-bought-together-shop.resolver';
import { FREQUENTLY_BOUGHT_TOGETHER_PLUGIN_OPTIONS } from './constants';
import { FrequentlyBoughtTogetherService } from './services/frequently-bought-together.service';
import { PluginInitOptions } from './types';

export type FrequentlyBoughtTogetherPluginOptions = Partial<PluginInitOptions>;

/**
 * Increase revenue by cross selling frequently bought together products.
 *
 * @category Plugin
 */
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
    // Set custom product to product relation
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
            'Products that are frequently bought together with the current product',
        },
      ],
      list: true,
      entity: Product,
      public: false,
      readonly: false,
      eager: false,
      nullable: true,
      ui: { tab: FrequentlyBoughtTogetherPlugin.options.customFieldUiTab },
    });
    // Set custom field for storing the support per product
    config.customFields.Product.push({
      name: 'frequentlyBoughtWithSupport',
      type: 'text',
      internal: true,
      public: false,
      nullable: true,
    });
    return config;
  },
  compatibility: '>=2.2.0',
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [FrequentlyBoughtTogetherAdminResolver],
  },
  shopApiExtensions: {
    schema: shopApiExtensions,
    resolvers: [FrequentlyBoughtTogetherShopResolver],
  },
})
export class FrequentlyBoughtTogetherPlugin {
  static options: PluginInitOptions = {
    customFieldUiTab: 'Related products',
    experimentMode: false,
    supportLevel: 0.01,
    maxRelatedProducts: 10,
  };

  static init(
    options: FrequentlyBoughtTogetherPluginOptions
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
