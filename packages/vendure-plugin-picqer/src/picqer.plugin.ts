import {
  PluginCommonModule,
  ProductVariant,
  VendurePlugin,
} from '@vendure/core';
import { PicqerResolver, shopSchema } from './api/api-extensions';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { PicqerProduct } from './types';

export interface PicqerOptions {
  enabled: boolean;
  /**
   * Implement this function if you'd like to sync additional fields from Picqer to Vendure,
   * thus making Picqer responsible for the value of fields.
   * @example
   * // Store weight in grams from Picqer as weight in KG in Vendure
   * importFieldsFromPicqer: (product) => ({ 'customFields.weight: product.weight / 1000 })
   */
  importFieldsFromPicqer?: (product: PicqerProduct) => Partial<ProductVariant>;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => PicqerPlugin.options,
    },
  ],
  shopApiExtensions: {
    resolvers: [PicqerResolver],
    schema: shopSchema,
  },
})
export class PicqerPlugin {
  static options: PicqerOptions;

  static init(options: PicqerOptions) {
    this.options = options;
    return PicqerPlugin;
  }
}
