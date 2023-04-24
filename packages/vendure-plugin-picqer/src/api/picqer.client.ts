import axios, { AxiosInstance } from 'axios';
import {
  ProductInput,
  ProductData,
  VatGroup,
  Webhook,
  WebhookInput,
  CustomerInput,
  CustomerData,
  OrderInput,
  OrderData,
} from './types';
import { loggerCtx } from '../constants';
import { Logger } from '@vendure/core';
import crypto from 'crypto';

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

  readonly apiKey: string;

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
    this.apiKey = apiKey;
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
  ): Promise<ProductData | undefined> {
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
  async getAllActiveProducts(): Promise<ProductData[]> {
    const allProducts: ProductData[] = [];
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

  async createProduct(input: ProductInput): Promise<ProductData> {
    return this.rawRequest('post', '/products', input);
  }

  async updateProduct(
    productId: string | number,
    input: ProductInput
  ): Promise<ProductData> {
    return this.rawRequest('put', `/products/${productId}`, input);
  }

  /**
   * Add an image to a product
   */
  async addImage(
    productId: string | number,
    base64EncodedImage: string
  ): Promise<ProductData> {
    return this.rawRequest('post', `/products/${productId}/images`, {
      image: base64EncodedImage,
    });
  }

  /**
   * Get all registered webhooks
   */
  async getWebhooks(): Promise<Webhook[]> {
    return this.rawRequest('get', `/hooks`);
  }

  /**
   * Create new webhook
   */
  async createWebhook(input: WebhookInput): Promise<Webhook> {
    return this.rawRequest('post', `/hooks`, input);
  }

  async deactivateHook(id: number): Promise<void> {
    await this.rawRequest('delete', `/hooks/${id}`);
  }

  async createOrder(input: OrderInput): Promise<OrderData> {
    return this.rawRequest('post', `/orders/`, input);
  }

  /**
   * Update the order to 'processing' in Picqer
   */
  async processOrder(id: number): Promise<OrderData> {
    return this.rawRequest('post', `/orders/${id}/process`);
  }

  async getCustomer(emailAddress: string): Promise<CustomerData | undefined> {
    const customers: CustomerData[] = await this.rawRequest(
      'get',
      `/customers?search=${encodeURIComponent(emailAddress)}`
    );
    if (!customers.length) {
      return undefined;
    }
    if (customers.length === 1) {
      return customers[0];
    }
    const customer = customers[0];
    Logger.warn(
      `Picqer returned multiple customers for email address ${emailAddress}, using the first result (${customer.idcustomer})`,
      loggerCtx
    );
    return customer;
  }

  async createCustomer(input: CustomerInput): Promise<CustomerData> {
    return this.rawRequest('post', `/customers/`, input);
  }

  async updateCustomer(
    id: number,
    input: CustomerInput
  ): Promise<CustomerData> {
    return this.rawRequest('put', `/customers/${id}`, input);
  }

  /**
   * Update existing customer or create new customer if not found
   */
  async createOrUpdateCustomer(
    emailAddress: string,
    input: CustomerInput
  ): Promise<CustomerData> {
    const existingCustomer = await this.getCustomer(emailAddress);
    if (!existingCustomer) {
      Logger.info(
        `Customer '${emailAddress}' not found, creating new customer`,
        loggerCtx
      );
      return this.createCustomer(input);
    }
    Logger.info(
      `Existing customer '${emailAddress}' found, updating customer ${existingCustomer.idcustomer}`,
      loggerCtx
    );
    return this.updateCustomer(existingCustomer.idcustomer, input);
  }

  /**
   * Get or create a customer based on EmailAddress.
   * If the customer is not found, a new minimal customer is created with
   * only an email address and a name.
   */
  async getOrCreateMinimalCustomer(
    emailAddress: string,
    name: string
  ): Promise<CustomerData> {
    const existingCustomer = await this.getCustomer(emailAddress);
    if (existingCustomer) {
      return existingCustomer;
    }
    Logger.info(
      `Customer '${emailAddress}' not found, creating new customer`,
      loggerCtx
    );
    return this.createCustomer({ emailaddress: emailAddress, name });
  }

  /**
   * Update existing product or create new product if not found
   */
  async createOrUpdateProduct(
    sku: string,
    input: ProductInput
  ): Promise<ProductData> {
    const product = await this.getProductByCode(sku);
    if (!product) {
      Logger.info(
        `Product '${sku}' not found, creating new product`,
        loggerCtx
      );
      return this.createProduct(input);
    }
    const productId = product.idproduct;
    Logger.info(
      `Existing product '${productId}' found, updating product ${productId}`,
      loggerCtx
    );
    return this.updateProduct(productId, input);
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

  isSignatureValid(data: string, incomingSignature: string): boolean {
    const computedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(data)
      .digest('base64');
    return computedSignature === incomingSignature;
  }

  /**
   * Use apiKey to generate a short hash that we use as webhook secret
   */
  get webhookSecret(): string {
    return crypto
      .createHash('shake256', { outputLength: 10 })
      .update(this.apiKey)
      .digest('hex');
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
