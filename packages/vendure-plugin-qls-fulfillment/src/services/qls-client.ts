import { Logger } from '@vendure/core';
import { QlsApiResponse, QlsClientConfig } from '../types';
import { loggerCtx } from '../constants';

/**
 * Wrapper around the QLS Rest API.
 */
export class QlsClient {
  constructor(private readonly config: QlsClientConfig) {}

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
    const response = await fetch(
      `https://api.pakketdienstqls.nl/companies/${this.config.companyId}/${action}`,
      {
        method,
        headers,
        body,
      }
    );

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
