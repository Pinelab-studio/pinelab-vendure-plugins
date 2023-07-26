import {
  LanguageCode,
  PluginCommonModule,
  Type,
  VendurePlugin,
} from '@vendure/core';
import { AddItemOverrideResolver } from './add-item-override.resolver';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [],
  shopApiExtensions: {
    resolvers: [AddItemOverrideResolver],
  },
  configuration: (config) => {
    config.customFields.ProductVariant.push({
      name: 'maxPerOrder',
      type: 'int',
      public: true,
      nullable: true,
      label: [
        {
          languageCode: LanguageCode.en,
          value: 'Maximum amount per order',
        },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value:
            'Limit how many of this product can be bought in a single order. Empty or 0 means a customer can order as many as he wants',
        },
      ],
      //      ui: { tab: "pickup" }
    });
    return config;
  },
  compatibility: '^2.0.0',
})
export class LimitVariantPerOrderPlugin {}
