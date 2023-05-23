import {
  Order,
  PluginCommonModule,
  ProductVariant,
  VendurePlugin,
} from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { OrderInput, ProductInput } from './api/types';
import { adminSchema } from './api/api-extensions';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { picqerPermission } from '.';
import { PicqerConfigEntity } from './api/picqer-config.entity';
import { PicqerService } from './api/picqer.service';
import { PicqerResolver } from './api/picqer.resolvers';
import { PicqerController } from './api/picqer.controller';
import { createRawBodyMiddleWare } from '../../util/src/raw-body';
import { UpdateProductVariantInput } from '@vendure/common/lib/generated-types';
import { picqerHandler } from './api/picqer.handler';

export interface PicqerOptions {
  enabled: boolean;
  /**
   * The URL of your Vendure instance, e.g. "https://my-vendure-instance.io"
   * Used to register webhooks in Picqer
   */
  vendureHost: string;
  /**
   * Implement this function if you'd like to pull additional fields from Picqer to Vendure,
   * thus making Picqer responsible for the value of fields.
   * @example
   * // Store weight in grams from Picqer as weight in KG in Vendure
   * pullPicqerProductFields: (product) => ({ customFields: { weight: product.weight / 1000 }})
   */
  pullPicqerProductFields?: (
    product: ProductInput
  ) => Partial<UpdateProductVariantInput>;
  /**
   * Implement this function if you'd like to sync additional (custom) fields from Vendure to Picqer,
   * @example
   * // Store `variant.customFields.EAN` from Vendure as `product.barcode` in Picqer
   * pushProductVariantFields: (variant) => ({ barcode: variant.customFields.EAN }})
   */
  pushProductVariantFields?: (variant: ProductVariant) => Partial<ProductInput>;
  /**
   * Add a note to order in Picqer
   * @example
   * // Push `order.customFields.customerNote` to Picqer
   * addPicqerOrderNote: (order) => `This is note from Vendure ${order.customFields.customerNote}`)
   */
  addPicqerOrderNote?: (order: Order) => string;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  controllers: [PicqerController],
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
    config.apiOptions.middleware.push(createRawBodyMiddleWare('/picqer*'));
    config.authOptions.customPermissions.push(picqerPermission);
    config.shippingOptions.fulfillmentHandlers.push(picqerHandler);
    return config;
  },
})
export class PicqerPlugin {
  static options: PicqerOptions;

  static init(options: PicqerOptions) {
    if (options.enabled !== false) {
      // Only disable if explicitly set to false
      options.enabled = true;
    }
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
