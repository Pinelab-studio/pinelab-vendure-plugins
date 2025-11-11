import { Logger, RequestContext } from '@vendure/core';
import { loggerCtx } from '../constants';
import type {
  QlsApiResponse,
  QlsClientConfig,
  QlsCreateFulfillmentProductRequest,
  QlsCreateFulfillmentProductResponse,
  QlsPluginOptions,
  QlsUpdateFulfillmentProductRequest,
  QLSUpdateFulfillmentProductResponse,
} from '../types';

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
  async getProductBySku(sku: string): Promise<any> {
    const result = await this.rawRequest<any[]>(
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

  async createFulfillmentProduct(data: QlsCreateFulfillmentProductRequest) {
    // TODO handle errors
    const response = await this.rawRequest<QlsCreateFulfillmentProductResponse>(
      'POST',
      'fulfillment/products',
      data
    );

    return response.data;
  }

  async updateFulfillmentProduct(
    fulfillmentProductId: string,
    data: QlsUpdateFulfillmentProductRequest
  ) {
    // TODO handle errors
    const response = await this.rawRequest<QLSUpdateFulfillmentProductResponse>(
      'PUT',
      `fulfillment/products/${fulfillmentProductId}`,
      data
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
