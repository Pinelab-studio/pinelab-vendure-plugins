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
  FulfillmentOrder,
  FulfillmentOrderInput,
  FulfillmentOrderReceiverContactInput,
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
   * Disable the pulling in of stock levels from QLS. When disabled, stock in Vendure will not be modified based on QLS stock levels.
   * Useful for testing out order sync separately, or testing against a QLS test env that has no stock for example
   */
  disableStockSync?: boolean;
  /**
   * Optional function to determine if a product variant should be excluded from syncing to QLS.
   * Return true to exclude the variant from sync, false or undefined to include it.
   */
  excludeVariantFromSync?: (
    ctx: RequestContext,
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
