import {
  LanguageCode,
  PluginCommonModule,
  Product,
  Type,
  VendurePlugin,
} from '@vendure/core';

import { FREQUENTLY_BOUGHT_TOGETHER_PLUGIN_OPTIONS } from './constants';
import { FrequentlyBoughtTogetherService } from './services/frequently-bought-together.service';
import { PluginInitOptions } from './types';

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
  compatibility: '>=2.3.0',
  //   adminApiExtensions: {
  //     schema: adminApiExtensions,
  //     resolvers: [FrequentlyBoughtTogetherAdminResolver],
  //   },
})
export class FrequentlyBoughtTogetherPlugin {
  static options: PluginInitOptions = {
    maxRelatedProducts: 5,
    customFieldUiTab: 'Related products',
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
}
