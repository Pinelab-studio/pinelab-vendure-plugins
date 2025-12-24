import {
  ID,
  Injector,
  Order,
  ProductVariant,
  RequestContext,
  SerializedRequestContext,
} from '@vendure/core';
import {
  CustomValue,
  FulfillmentOrderInput,
  FulfillmentProductInput,
} from './lib/client-types';

export interface QlsPluginOptions {
  /**
   * Get the QLS client config for the current channel based on given context
   */
  getConfig: (
    ctx: RequestContext
  ) => QlsClientConfig | undefined | Promise<QlsClientConfig | undefined>;
  /**
   * Required to get the EAN and image URL for a product variant.
   * Also allows you to override other product attributes like name, price, etc.
   */
  getAdditionalVariantFields: (
    ctx: RequestContext,
    variant: ProductVariant
  ) => AdditionalVariantFields;

  /**
   * Function to get the set service point code for an order.
   * Return undefined to not use a service point at all.
   */
  getAdditionalOrderFields?: (
    ctx: RequestContext,
    injector: Injector,
    order: Order
  ) =>
    | Promise<AdditionalOrderFields | undefined>
    | AdditionalOrderFields
    | undefined;
  /**
   * A key used to verify if the caller is authorized to call the webhook.
   * Set this to a random string
   */
  webhookSecret: string;
  /**
   * Allows you to disable the pulling in of stock levels from QLS. When disabled, stock in Vendure will not be modified based on QLS stock levels.
   * Defaults to true.
   */
  synchronizeStockLevels?: boolean;
  /**
   * Allows you to disable the automatic pushing of orders to QLS. You can still push orders manually via the Admin UI.
   * Defaults to true.
   */
  autoPushOrders?: boolean;
  /**
   * Allows you to define a date from when the order should be processed by QLS.
   * You can for example make orders processable 2 hours from now, so that you can still edit the order in QLS
   * Defaults to now.
   */
  processOrderFrom?: (
    ctx: RequestContext,
    order: Order
  ) => Date | Promise<Date>;
  /**
   * Optional function to determine if a product variant should be excluded from syncing to QLS.
   * Return true to exclude the variant from sync, false or undefined to include it.
   */
  excludeVariantFromSync?: (
    ctx: RequestContext,
    injector: Injector,
    variant: ProductVariant
  ) => boolean | Promise<boolean>;
  /**
   * Optional function to customize the receiver contact details when creating a QLS order.
   * Allows you to set different fields or override default mapping from the order's shipping address and customer.
   * If not provided, default mapping will be used.
   */
  getReceiverContact?: (
    ctx: RequestContext,
    order: Order
  ) => FulfillmentOrderInput['receiver_contact'] | undefined;
}

/**
 * Additional fields for a product variant that are used to create or update a product in QLS
 */
export type AdditionalVariantFields = Partial<
  FulfillmentProductInput & { ean: string; additionalEANs?: string[] }
>;

export interface AdditionalOrderFields {
  servicepoint_code?: string;
  delivery_options?: string[];
  custom_values?: CustomValue[];
}

/**
 * Job data required for pushing an order to QLS
 */
export interface QlsOrderJobData {
  action: 'push-order';
  ctx: SerializedRequestContext;
  orderId: ID;
}

export type QlsProductJobData = FullProductsSyncJobData | ProductsSyncJobData;

/**
 * Job data required for pushing products to QLS (full sync)
 */
export interface FullProductsSyncJobData {
  action: 'full-sync-products';
  ctx: SerializedRequestContext;
}

/**
 * Job data required for creating/updating fulfillment products in QLS (no full sync)
 */
export interface ProductsSyncJobData {
  action: 'sync-products';
  ctx: SerializedRequestContext;
  productVariantIds: ID[];
}

export interface QlsClientConfig {
  username: string;
  password: string;
  companyId: string;
  brandId: string;
  /**
   * defaults to 'https://api.pakketdienstqls.nl'
   */
  url?: string;
}
