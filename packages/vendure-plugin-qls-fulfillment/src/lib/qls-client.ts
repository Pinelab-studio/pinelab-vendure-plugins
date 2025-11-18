import { Logger, RequestContext } from '@vendure/core';
import { loggerCtx } from '../constants';
import { QlsClientConfig, QlsPluginOptions } from '../types';
import type {
  FulfillmentOrder,
  FulfillmentOrderInput,
  FulfillmentProduct,
  FulfillmentProductInput,
  QlsApiResponse,
} from './client-types';

export async function getQlsClient(
  ctx: RequestContext,
  pluginOptions: QlsPluginOptions
): Promise<QlsClient | undefined> {
  const config = await pluginOptions.getConfig(ctx);
  if (!config) {
    Logger.info(`QLS not enabled for channel ${ctx.channel.token}`, loggerCtx);
    return undefined;
  }
  return new QlsClient(config);
}

/**
 * Wrapper around the QLS Rest API.
 */
export class QlsClient {
  private baseUrl: string;

  constructor(private readonly config: QlsClientConfig) {
    this.baseUrl = config.url || 'https://api.pakketdienstqls.nl';
  }

  /**
   * Find a product by SKU.
   * Returns the first product found, or undefined if no product is found.
   */
  async getFulfillmentProductBySku(
    sku: string
  ): Promise<FulfillmentProduct | undefined> {
    const result = await this.rawRequest<FulfillmentProduct[]>(
      'GET',
      `fulfillment/products?filter%5Bsku%5D=${encodeURIComponent(sku)}`
    );
    if (result.data.length === 0) {
      return undefined;
    }
    if (result.data.length > 1) {
      Logger.error(
        `Multiple products found for SKU: ${sku}`,
        loggerCtx,
        JSON.stringify(result.data)
      );
    }
    return result.data[0];
  }

  /**
   * Get stock for all fulfillment products.
   * Might require multiple requests if the result is paginated.
   */
  async getAllFulfillmentProducts(): Promise<FulfillmentProduct[]> {
    let page = 1;
    const allProducts: FulfillmentProduct[] = [];
    let hasNextPage = true;
    while (hasNextPage) {
      const result = await this.rawRequest<FulfillmentProduct[]>(
        'GET',
        `fulfillment/products?page=${page}`
      );
      if (!result.data || result.data.length === 0) {
        break;
      }
      allProducts.push(...result.data);
      hasNextPage = result.pagination?.nextPage ?? false;
      page++;
    }
    return allProducts;
  }

  async createFulfillmentProduct(
    data: FulfillmentProductInput
  ): Promise<FulfillmentProduct> {
    const response = await this.rawRequest<FulfillmentProduct>(
      'POST',
      'fulfillment/products',
      data
    );
    return response.data;
  }

  async updateFulfillmentProduct(
    fulfillmentProductId: string,
    data: FulfillmentProductInput
  ): Promise<FulfillmentProduct> {
    const response = await this.rawRequest<FulfillmentProduct>(
      'PUT',
      `fulfillment/products/${fulfillmentProductId}`,
      data
    );
    return response.data;
  }

  async createFulfillmentOrder(
    data: Omit<FulfillmentOrderInput, 'brand_id'>
  ): Promise<FulfillmentOrder> {
    const response = await this.rawRequest<FulfillmentOrder>(
      'POST',
      'fulfillment/orders',
      {
        ...data,
        brand_id: this.config.brandId,
      }
    );
    return response.data;
  }

  async rawRequest<T>(
    method: 'POST' | 'GET' | 'PUT' | 'DELETE',
    action: string,
    data?: unknown
  ): Promise<QlsApiResponse<T>> {
    // Set headers
    const headers: Record<string, string> = {
      Authorization: `Basic ${Buffer.from(
        `${this.config.username}:${this.config.password}`
      ).toString('base64')}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    const body = data ? JSON.stringify(data) : undefined;
    const url = `${this.baseUrl}/companies/${this.config.companyId}/${action}`;
    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Log error including the request body
      Logger.error(
        `QLS request failed: ${response.status} ${response.statusText} - ${errorText}`,
        loggerCtx,
        data ? JSON.stringify(data, null, 2) : undefined
      );
      throw new Error(errorText);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return response.json() as Promise<QlsApiResponse<T>>;
    }
    throw new Error(`Unexpected content type: ${contentType}`);
  }
}
