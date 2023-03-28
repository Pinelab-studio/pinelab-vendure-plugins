import {
  PluginCommonModule,
  ProductVariant,
  VendurePlugin,
} from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { PicqerProduct } from './api/types';
import { adminSchema, PicqerResolver } from './api/api-extensions';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { permission } from '.';
import { PicqerConfigEntity } from './api/picqer-config.entity';
import { PicqerService } from './api/picqer.service';

export interface PicqerOptions {
  enabled: boolean;
  /**
   * Implement this function if you'd like to sync additional fields from Picqer to Vendure,
   * thus making Picqer responsible for the value of fields.
   * @example
   * // Store weight in grams from Picqer as weight in KG in Vendure
   * importFieldsFromPicqer: (product) => ({ customFields: { weight: product.weight / 1000 }})
   */
  importFieldsFromPicqer?: (product: PicqerProduct) => Partial<ProductVariant>;
  /**
   * Implement this function if you'd like to sync additional (custom) fields from Vendure to Picqer,
   * @example
   * // Store `variant.customFields.EAN` from Vendure as `product.barcode` in Picqer
   * importFieldsToPicqer: (variant) => ({ barcoe: variant.customFields.EAN }})
   */
  importFieldsToPicqer?: (variant: ProductVariant) => Partial<PicqerProduct>;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => PicqerPlugin.options,
    },
    PicqerService,
  ],
  adminApiExtensions: {
    resolvers: [PicqerResolver],
    schema: adminSchema,
  },
  entities: [PicqerConfigEntity],
  configuration: (config) => {
    // config.shippingOptions.fulfillmentHandlers.push(picqerHandler);
    config.authOptions.customPermissions.push(permission);
    return config;
  },
})
export class PicqerPlugin {
  static options: PicqerOptions;

  static init(options: PicqerOptions) {
    this.options = options;
    return PicqerPlugin;
  }

  /**
   * Admin UI configuration needed to register the Picqer UI modules
   */
  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    ngModules: [
      {
        type: 'lazy',
        route: 'picqer',
        ngModuleFileName: 'picqer-modules.ts',
        ngModuleName: 'PicqerLazyModule',
      },
      {
        type: 'shared',
        ngModuleFileName: 'picqer-modules.ts',
        ngModuleName: 'PicqerSharedModule',
      },
    ],
  };
}
