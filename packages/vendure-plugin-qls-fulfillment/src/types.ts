import { ID, RequestContext, SerializedRequestContext } from '@vendure/core';

export interface QlsPluginOptions {
  /**
   * Get the QLS client config for the current channel based on given context
   */
  getConfig: (
    ctx: RequestContext
  ) => QlsClientConfig | undefined | Promise<QlsClientConfig | undefined>;
}

export type QlsJobData =
  | PushOrderJobData
  | FullProductsSyncJobData
  | CreateProductsJobData
  | UpdateProductsJobData;

/**
 * Job data required for pushing an order to QLS
 */
export interface PushOrderJobData {
  action: 'push-order';
  ctx: SerializedRequestContext;
  orderId: ID;
}

/**
 * Job data required for pushing products to QLS (full sync)
 */
export interface FullProductsSyncJobData {
  action: 'sync-products';
  ctx: SerializedRequestContext;
}

/**
 * Job data required for creating fulfillment products in QLS (no full sync)
 */
export interface CreateProductsJobData {
  action: 'create-products';
  ctx: SerializedRequestContext;
  productVariantIds: ID[];
}

/**
 * Job data required for deleting fulfillment products in QLS
 */
export interface UpdateProductsJobData {
  action: 'update-products';
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

export interface QlsApiResponse<T> {
  meta: {
    code: number;
  };
  data: T;
  pagination?: {
    page: number;
    limit: number;
    count: number;
    pageCount: number;
    nextPage: boolean;
    prevPage: boolean;
  };
}

export type QlsFulfilllmentProductSyncedAttributes = {
  ean?: string;
  sku?: string;
  image_url?: string;
  shop_integration_id?: string;
  shop_integration_reference?: string;
  price_cost?: number;
  price_store?: number;
  order_unit?: number | null;
};

export type QlsCreateFulfillmentProductResponse = {
  id: string;
  company_id: string;
  name: string;
  description: string;
  ean: string;
  sku: string;
  hs_code: string;
  amount_available: number;
  amount_total: number;
  amount_reserverd: number;
  image_url: number;
  price_cost: number;
  price_store: number;
  order_unit: number;
  created: string;
  modified: string;
};

export type QlsCreateFulfillmentProductRequest = {
  name: string;
} & QlsFulfilllmentProductSyncedAttributes;

export type QlsUpdateFulfillmentProductRequest =
  QlsFulfilllmentProductSyncedAttributes;

export type QLSUpdateFulfillmentProductResponse =
  QlsCreateFulfillmentProductResponse;

export type QlsWarehouseZone = {
  id: number;
  name: string;
  pickable: boolean;
  warehouse: {
    id: number;
    name: string;
    is_fulfillment: boolean;
    cutoff: string;
  };
};

export type QlsProductBatch = {
  id: number;
  code: string;
  status: string;
  best_before: string;
};

export type QlsWarehouseStock = {
  id: string;
  zone_id: number;
  row_number: string;
  rack_number: string;
  shelf_number: string;
  number: string;
  amount_current: number;
  amount_reserved: number;
  best_before: string;
  best_before_cutoff: string;
  warehouse_zone: QlsWarehouseZone;
  product_batch: QlsProductBatch[];
};

export type QlsFulfillmentProduct = {
  article_number: string;
  id: string;
  name: string;
  ean: string;
  sku: string;
  amount_total: number;
  amount_reserved: number;
  amount_blocked: number;
  price_cost: number;
  price_store: number;
  order_unit: null;
  warehouse_stocks: QlsWarehouseStock[];
};
