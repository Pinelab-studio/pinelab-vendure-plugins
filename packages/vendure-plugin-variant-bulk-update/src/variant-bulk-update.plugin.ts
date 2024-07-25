import {
  LanguageCode,
  PLUGIN_INIT_OPTIONS,
  PluginCommonModule,
  VendurePlugin,
} from '@vendure/core';
import { BulkUpdateService } from './bulk-update-service';
import { OnApplicationBootstrap } from '@nestjs/common';

export interface BulkUpdateOptions {
  /**
   * Add's a customfield 'price' to the product, which will update a variants price
   */
  enablePriceBulkUpdate: boolean;
  /**
   * Updates the defined custom fields all variants of the product when the product's custom field is updated.
   * This requires your project to have the same custom field definitions on both the Product and the Variant
   */
  bulkUpdateCustomFields: string[];
}

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    BulkUpdateService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => VariantBulkUpdatePlugin.options,
    },
  ],
  configuration: (config) => {
    if (VariantBulkUpdatePlugin.options?.enablePriceBulkUpdate) {
      // Only add customField if the price update is enabled
      config.customFields.Product.push({
        name: 'price',
        type: 'int',
        public: true,
        nullable: true,
        label: [
          {
            languageCode: LanguageCode.en,
            value: 'Price',
          },
        ],
        description: [
          {
            languageCode: LanguageCode.en,
            value:
              'Setting this field will update the variant prices every time you update the product',
          },
        ],
        ui: { tab: 'Bulk update', component: 'currency-form-input' },
      });
    }
    return config;
  },
  compatibility: '>=2.2.0',
})
export class VariantBulkUpdatePlugin implements OnApplicationBootstrap {
  static options: BulkUpdateOptions;

  static init(options: BulkUpdateOptions): typeof VariantBulkUpdatePlugin {
    this.options = options;
    return VariantBulkUpdatePlugin;
  }

  onApplicationBootstrap() {
    if (!VariantBulkUpdatePlugin.options) {
      throw Error(
        'Please use VariantBulkUpdatePlugin.init({ // options }) to initialize this plugin. See the README for more information'
      );
    }
  }
}
