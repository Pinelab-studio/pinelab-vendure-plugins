import {
  ID,
  Injector,
  Order,
  ProductVariant,
  RequestContext,
  SerializedRequestContext,
} from '@vendure/core';
import { CustomValue, FulfillmentProductInput } from './lib/client-types';

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
  getAdditionalVariantFields?: (
    ctx: RequestContext,
    variant: ProductVariant
  ) => Partial<FulfillmentProductInput>;

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
}

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
   * if set to `true` the actual API calls will not be made but instead logged
   */
  mock?: boolean;
  /**
   * defaults to 'https://api.pakketdienstqls.nl'
   */
  url?: string;
}
