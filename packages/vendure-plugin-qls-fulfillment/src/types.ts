import {
  ID,
  ProductVariant,
  RequestContext,
  SerializedRequestContext,
} from '@vendure/core';

export interface QlsPluginOptions {
  /**
   * Get the QLS client config for the current channel based on given context
   */
  getConfig: (
    ctx: RequestContext
  ) => QlsClientConfig | undefined | Promise<QlsClientConfig | undefined>;
  /**
   * Required to get the EAN and image URL for a product variant
   */
  getAdditionalVariantFields?: (
    ctx: RequestContext,
    variant: ProductVariant
  ) => { ean: string; imageUrl?: string };
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
  /**
   * if set to `true` the actual API calls will not be made but instead logged
   */
  mock?: boolean;
  /**
   * defaults to 'https://api.pakketdienstqls.nl'
   */
  url?: string;
}
