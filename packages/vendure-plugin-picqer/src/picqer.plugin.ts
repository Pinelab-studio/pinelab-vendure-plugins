import { UpdateProductVariantInput } from '@vendure/common/lib/generated-types';
import {
  Order,
  OrderLine,
  PluginCommonModule,
  ProductVariant,
  RequestContext,
  RuntimeVendureConfig,
  VendurePlugin,
} from '@vendure/core';
import { rawBodyMiddleware } from '../../util/src/raw-body.middleware';
import { adminSchema } from './api/api-extensions';
import { PicqerController } from './api/picqer.controller';
import { picqerHandler } from './api/picqer.handler';
import { PicqerResolver } from './api/picqer.resolvers';
import { PicqerService } from './api/picqer.service';
import { ProductData, ProductInput } from './api/types';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { channelCustomFields, picqerPermission } from './custom-fields';

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
    product: ProductInput & ProductData,
  ) => Partial<UpdateProductVariantInput>;
  /**
   * Implement this function if you'd like to sync additional (custom) fields from Vendure to Picqer,
   * @example
   * // Store `variant.customFields.EAN` from Vendure as `product.barcode` in Picqer
   * pushProductVariantFields: (variant) => ({ barcode: variant.customFields.EAN }})
   */
  pushProductVariantFields?: (
    variant: ProductVariant,
  ) => Partial<ProductInput & ProductData>;
  /**
   * Map any Vendure fields to Order fields in Picqer.
   * See https://picqer.com/en/api/orders#attributes for available Picqer fields
   * @example
   * pushPicqerOrderFields: (order) => {customer_remarks: 'Please don't package my order in plastic'})
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pushPicqerOrderFields?: (order: Order) => any;
  /**
   * Map any Vendure fields to Order.products fields in Picqer.
   * See https://picqer.com/en/api/orders#attributes for available Picqer fields
   * @example
   * pushPicqerOrderLineFields: (orderLine) => {remarks: 'Please write "Happy birthday" on the box of this item'})
   */
  pushPicqerOrderLineFields?: (
    ctx: RequestContext,
    orderLine: OrderLine,
    order: Order,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => any;
  /**
   * Define wether to trigger a sync when one of these custom fields is updated on a ProductVariant
   */
  shouldSyncOnProductVariantCustomFields?: string[];
  /**
   * Define wether to fall back to a variant's product, when the variant does not have a featured asset.
   * Default is `true`
   */
  fallBackToProductFeaturedAsset?: boolean;
  /**
   * Define wether to cancel orders in Vendure when they are cancelled in Picqer.
   * Default is `true`
   *
   * When, for example, orders in Picqer are cancelled solely because they need to be edited, you might want to disable this feature.
   */
  cancelOrdersOnPicqerCancellation?: boolean;
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
  configuration: (config: RuntimeVendureConfig) => {
    config.apiOptions.middleware.push({
      route: '/picqer*splat',
      handler: rawBodyMiddleware,
      beforeListen: true,
    });
    config.authOptions.customPermissions.push(picqerPermission);
    config.shippingOptions.fulfillmentHandlers.push(picqerHandler);
    config.customFields.Channel.push(...channelCustomFields);
    return config;
  },
  compatibility: '>=3.2.0',
})
export class PicqerPlugin {
  static options: PicqerOptions;

  static init(options: PicqerOptions) {
    PicqerPlugin.options = {
      fallBackToProductFeaturedAsset: true,
      cancelOrdersOnPicqerCancellation: true,
      ...options,
    };
    return PicqerPlugin;
  }
}
