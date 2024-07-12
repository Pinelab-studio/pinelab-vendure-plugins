import { LanguageCode, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { AddItemOverrideResolver } from './add-item-override.resolver';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';

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
    });
    config.customFields.ProductVariant.push({
      name: 'onlyAllowPer',
      type: 'text',
      public: true,
      list: true,
      ui: { component: 'channel-aware-int-form-input' },
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
export class LimitVariantPerOrderPlugin {
  public static uiExtensions: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    providers: ['providers.ts'],
  };
}
