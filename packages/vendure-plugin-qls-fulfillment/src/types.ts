import { ID, RequestContext, SerializedRequestContext } from '@vendure/core';

export interface QlsPluginOptions {
  /**
   * Get the QLS client config for the current channel based on given context
   */
  getConfig: (
    ctx: RequestContext
  ) => QlsClientConfig | undefined | Promise<QlsClientConfig | undefined>;
}

export type QlsJobData = PushOrderJobData | PushProductsJobData;

/**
 * Job data required for pushing an order to QLS
 */
export interface PushOrderJobData {
  action: 'push-order';
  ctx: SerializedRequestContext;
  orderId: ID;
}

/**
 * Job data required for pushing products to QLS
 */
export interface PushProductsJobData {
  action: 'push-products';
  ctx: SerializedRequestContext;
  variantIds: ID[]; // FIXME: probably a batch of id's?
}

export interface QlsClientConfig {
  username: string;
  password: string;
  companyId: string;
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
