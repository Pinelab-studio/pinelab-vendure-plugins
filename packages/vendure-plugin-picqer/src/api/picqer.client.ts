import axios, { AxiosInstance } from 'axios';
import { ProductInput, ProductResponse, VatGroup } from './types';
import { loggerCtx } from '../constants';
import { Logger } from '@vendure/core';

export interface PicqerClientInput {
  apiEndpoint: string;
  apiKey: string;
  storefrontUrl: string;
  supportEmail: string;
}

export class PicqerClient {
  readonly instance: AxiosInstance;
  /**
   * This is the default limit for lists in the Picqer API.
   * Resultsets greater than this will require pagination.
   */
  readonly responseLimit = 100;

  constructor({
    apiEndpoint,
    apiKey,
    storefrontUrl,
    supportEmail,
  }: PicqerClientInput) {
    this.instance = axios.create({
      baseURL: apiEndpoint,
      timeout: 5000,
      headers: {
        Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
        'User-Agent': `VendurePicqerPlugin (${storefrontUrl} - ${supportEmail})`,
      },
    });
  }

  async getStats(): Promise<any> {
    return this.rawRequest('get', '/stats');
  }

  async getVatGroups(): Promise<VatGroup[]> {
    const result = await this.rawRequest('get', '/vatgroups');
    if (result.length > this.responseLimit) {
      Logger.error(
        `Picqer response limit exceeded for getVatGroups(). Pagination is required, but this is not implemented yet.`,
        loggerCtx
      );
    }
    return result;
  }

  async getProductByCode(
    productCode: string
  ): Promise<ProductResponse | undefined> {
    const result = await this.rawRequest(
      'get',
      `/products?productcode=${productCode}`
    );
    if (result.length > 1) {
      throw Error(
        `Picqer returned multiple products for product code ${productCode}`
      );
    }
    return result?.[0];
  }

  async createProduct(input: ProductInput): Promise<ProductResponse> {
    return this.rawRequest('post', '/products', input);
  }

  async updateProduct(
    productId: string | number,
    input: ProductInput
  ): Promise<ProductResponse> {
    return this.rawRequest('put', `/products/${productId}`, input);
  }

  /**
   * Request wrapper with Picqer specific error handling
   */
  async rawRequest(
    method: 'post' | 'get' | 'put',
    url: string,
    data?: any
  ): Promise<any> {
    return (
      await this.instance({ method, url, data }).catch((e: any) =>
        this.handleError(e, url)
      )
    )?.data;
  }
  /**
   * Throw Picqer specific error messages
   */
  private handleError(e: any, url: string): void {
    if (e.response?.data?.error_message) {
      throw new Error(`${url}: ${e.response.data.error_message}`);
    } else {
      throw e;
    }
  }
}
