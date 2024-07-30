import { LanguageCode, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { AddItemOverrideResolver } from './api/add-item-override.resolver';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { shopSchemaExtensions } from './api/api-extensions';
import { LimitFieldsResolver } from './api/limit-fields.resolver';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [],
  shopApiExtensions: {
    schema: shopSchemaExtensions,
    resolvers: [AddItemOverrideResolver, LimitFieldsResolver],
  },
  configuration: (config) => {
    config.customFields.Product.push({
      name: 'maxPerOrder',
      type: 'text',
      list: true,
      public: false,
      nullable: true,
      ui: { component: 'channel-aware-int-form-input', tab: 'Limitations' },
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
    });
    config.customFields.Product.push({
      name: 'onlyAllowPer',
      type: 'text',
      public: false,
      list: true,
      ui: { component: 'channel-aware-int-form-input', tab: 'Limitations' },
      label: [
        {
          languageCode: LanguageCode.en,
          value: 'Multiple of per order',
        },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value:
            'The customer will only be allowed to add a multiple of "onlyAllowPer" of this product per order. Empty or 0 means a customer can order as many as he wants',
        },
      ],
    });
    return config;
  },
  compatibility: '^2.0.0',
})
export class LimitedProductsPlugin {
  public static uiExtensions: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    providers: ['providers.ts'],
  };
}
