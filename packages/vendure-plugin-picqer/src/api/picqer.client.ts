import { Logger } from '@vendure/core';
import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { loggerCtx } from '../constants';
import {
  CustomerData,
  CustomerInput,
  OrderData,
  OrderInput,
  ProductData,
  ProductInput,
  VatGroup,
  Warehouse,
  WebhookData,
  WebhookInput,
} from './types';

export interface PicqerClientInput {
  apiEndpoint: string;
  apiKey: string;
  storefrontUrl: string;
  supportEmail: string;
}

export class PicqerClient {
  readonly instance: AxiosInstance;
  /**
   * This is the default limit for everything that uses pagination in the Picqer API.
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getStats(): Promise<any> {
    return this.rawRequest('get', '/stats');
  }

  async getVatGroups(): Promise<VatGroup[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await this.rawRequest('get', '/vatgroups');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    this.logIfLimitExceeded(result, '/vatgroups');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result;
  }

  /**
   * Fetches active and inactive products
   */
  async getProductByCode(
    productCode: string
  ): Promise<ProductData | undefined> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [activeProducts, inactiveProducts] = await Promise.all([
      this.rawRequest(
        'get',
        `/products?productcode=${encodeURIComponent(productCode)}`
      ),
      this.rawRequest(
        'get',
        `/products?productcode=${encodeURIComponent(productCode)}&inactive`
      ),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const result = [...activeProducts, ...inactiveProducts];
    if (result.length > 1) {
      Logger.warn(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Picqer returned multiple products for product code ${productCode}, using the first result (${result[0].idproduct})`
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const products = await this.rawRequest(
        'get',
        `/products?offset=${offset}`
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      Logger.info(`Fetched ${products.length} products`, loggerCtx);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      allProducts.push(...products);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.rawRequest('post', '/products', input);
  }

  async updateProduct(
    productId: string | number,
    input: ProductInput
  ): Promise<ProductData> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.rawRequest('put', `/products/${productId}`, input);
  }

  /**
   * Add an image to a product
   */
  async addImage(
    productId: string | number,
    base64EncodedImage: string
  ): Promise<ProductData> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.rawRequest('post', `/products/${productId}/images`, {
      image: base64EncodedImage,
    });
  }

  /**
   * Get all registered webhooks
   */
  async getWebhooks(): Promise<WebhookData[]> {
    const allHooks = [];
    let hasMore = true;
    let offset = 0;
    while (hasMore) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const webhooks = await this.rawRequest('get', `/hooks?offset=${offset}`);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      allHooks.push(...webhooks);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (webhooks.length < this.responseLimit) {
        hasMore = false;
      }
      offset += this.responseLimit;
    }
    return allHooks as WebhookData[];
  }

  /**
   * Create new webhook
   */
  async createWebhook(input: WebhookInput): Promise<WebhookData> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.rawRequest('post', `/hooks`, input);
  }

  async deactivateHook(id: number): Promise<void> {
    await await this.rawRequest('delete', `/hooks/${id}`);
  }

  async createOrder(input: OrderInput): Promise<OrderData> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.rawRequest('post', `/orders/`, input);
  }

  /**
   * Update the order to 'processing' in Picqer
   */
  async processOrder(id: number): Promise<OrderData> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.rawRequest('post', `/orders/${id}/process`);
  }

  async getCustomer(emailAddress: string): Promise<CustomerData | undefined> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

  async getAllWarehouses(): Promise<Warehouse[]> {
    const allWarehouses: Warehouse[] = [];
    let hasMore = true;
    let offset = 0;
    while (hasMore) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const warehouses: Warehouse[] = await this.rawRequest(
        'get',
        `/warehouses?offset=${offset}`
      );
      Logger.info(`Fetched ${warehouses.length} warehouses`, loggerCtx);
      allWarehouses.push(...warehouses);
      if (warehouses.length < this.responseLimit) {
        hasMore = false;
      } else {
        Logger.info(`Fetching more...`, loggerCtx);
      }
      offset += this.responseLimit;
    }
    Logger.info(
      `Fetched a total of ${allWarehouses.length} warehouses`,
      loggerCtx
    );
    return allWarehouses;
  }

  async createCustomer(input: CustomerInput): Promise<CustomerData> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.rawRequest('post', `/customers/`, input);
  }

  async updateCustomer(
    id: number,
    input: CustomerInput
  ): Promise<CustomerData> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.rawRequest('put', `/customers/${id}`, input);
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
   *
   * Does not update VAT group when shouldUpdateVatGroup is false.
   * For example, when this is called when creating an order, the VAT group of the order should not be used to update the product.
   */
  async createOrUpdateProduct(
    sku: string,
    input: ProductInput,
    shouldUpdateVatGroup = true
  ): Promise<ProductData> {
    const product = await this.getProductByCode(sku);
    if (!product) {
      Logger.debug(
        `Product '${sku}' not found, creating new product in Picqer`,
        loggerCtx
      );
      return this.createProduct(input);
    }
    const productId = product.idproduct;
    Logger.debug(
      `Existing product '${productId}' found for sku '${sku}', updating product in Picqer`,
      loggerCtx
    );
    if (!shouldUpdateVatGroup) {
      // Keep VAT group as is
      input.idvatgroup = product.idvatgroup;
    }
    return this.updateProduct(productId, input);
  }

  /**
   * Request wrapper with Picqer specific error handling
   */
  async rawRequest(
    method: 'post' | 'get' | 'put' | 'delete',
    url: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const result = await this.instance({ method, url, data }).catch((e: any) =>
      this.handleError(e, url)
    );
    // eslint-disable-next-line  @typescript-eslint/no-unsafe-return
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleError(e: any, url: string): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (e.response?.data?.error_message) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
