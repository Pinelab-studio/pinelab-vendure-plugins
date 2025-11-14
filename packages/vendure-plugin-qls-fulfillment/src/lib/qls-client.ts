import { Logger, RequestContext } from '@vendure/core';
import { loggerCtx } from '../constants';
import type {
  QlsApiResponse,
  QlsFulfillmentProductInput,
  QlsFulfillmentProduct,
  FulfillmentOrderInput,
} from './client-types';
import { QlsClientConfig, QlsPluginOptions } from '../types';

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
  ): Promise<QlsFulfillmentProduct | undefined> {
    const result = await this.rawRequest<QlsFulfillmentProduct[]>(
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
  async getAllFulfillmentProducts(): Promise<QlsFulfillmentProduct[]> {
    let page = 1;
    const allProducts: QlsFulfillmentProduct[] = [];
    let hasNextPage = true;
    while (hasNextPage) {
      const result = await this.rawRequest<QlsFulfillmentProduct[]>(
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
    data: QlsFulfillmentProductInput
  ): Promise<QlsFulfillmentProduct> {
    const response = await this.rawRequest<QlsFulfillmentProduct>(
      'POST',
      'fulfillment/products',
      data
    );
    return response.data;
  }

  async updateFulfillmentProduct(
    fulfillmentProductId: string,
    data: QlsFulfillmentProductInput
  ): Promise<QlsFulfillmentProduct> {
    const response = await this.rawRequest<QlsFulfillmentProduct>(
      'PUT',
      `fulfillment/products/${fulfillmentProductId}`,
      data
    );
    return response.data;
  }

  async createFulfillmentOrder(
    data: Omit<FulfillmentOrderInput, 'brand_id'>
  ): Promise<FulfillmentOrderInput> {
    const response = await this.rawRequest<FulfillmentOrderInput>(
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
    if (this.config.mock) {
      Logger.debug(`Mock QLS API request: ${url}, ${body}`, loggerCtx);
      return {
        data: {} as T,
        meta: { code: -1 },
      };
    }

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
      throw new Error(
        `QLS request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return response.json() as Promise<QlsApiResponse<T>>;
    }
    throw new Error(`Unexpected content type: ${contentType}`);
  }
}
