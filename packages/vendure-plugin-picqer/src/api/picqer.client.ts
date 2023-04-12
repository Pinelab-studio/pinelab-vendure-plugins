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
    apiEndpoint = apiEndpoint.replace(/\/$/, ''); // Remove trailing slash
    this.instance = axios.create({
      baseURL: `${apiEndpoint}/api/v1/`,
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
    this.logIfLimitExceeded(result, '/vatgroups');
    return result;
  }

  /**
   * Fetches active and inactive products
   */
  async getProductByCode(
    productCode: string
  ): Promise<ProductResponse | undefined> {
    const [activeProducts, inactiveProducts] = await Promise.all([
      this.rawRequest('get', `/products?productcode=${productCode}`),
      this.rawRequest('get', `/products?productcode=${productCode}&inactive`),
    ]);
    const result = [...activeProducts, ...inactiveProducts];
    if (result.length > 1) {
      Logger.warn(
        `Picqer returned multiple products for product code ${productCode}, using the first result (${result[0].idproduct})`
      );
    }
    return result?.[0];
  }

  /**
   * Fetches all active products
   */
  async getAllActiveProducts(): Promise<ProductResponse[]> {
    const allProducts: ProductResponse[] = [];
    let hasMore = true;
    let offset = 0;
    while (hasMore) {
      const products = await this.rawRequest(
        'get',
        `/products?offset=${offset}`
      );
      Logger.info(`Fetched ${products.length} products`, loggerCtx);
      allProducts.push(...products);
      if (products.length < this.responseLimit) {
        hasMore = false;
      } else {
        Logger.info(`Fetching more...`, loggerCtx);
      }
      offset += this.responseLimit;
    }
    Logger.info(`Fetched a total of ${allProducts.length} products`, loggerCtx);
    return allProducts;
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
   * Add an image to a product
   */
  async addImage(
    productId: string | number,
    base64EncodedImage: string
  ): Promise<ProductResponse> {
    return this.rawRequest('post', `/products/${productId}/images`, {
      image: base64EncodedImage,
    });
  }

  /**
   * Request wrapper with Picqer specific error handling
   */
  async rawRequest(
    method: 'post' | 'get' | 'put' | 'delete',
    url: string,
    data?: any
  ): Promise<any> {
    const result = await this.instance({ method, url, data }).catch((e: any) =>
      this.handleError(e, url)
    );
    return result?.data;
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

  private logIfLimitExceeded(results: unknown[], path: string): void {
    if (results.length > this.responseLimit) {
      Logger.error(
        `Picqer response limit exceeded for "${path}". Pagination is required, but this is not implemented yet.`,
        loggerCtx
      );
    }
  }
}
