import fetch from 'node-fetch';
import {
  GoedgepicktEvent,
  Order,
  OrderInput,
  Product,
  ProductInput,
  Webhook,
} from './goedgepickt.types';
import { Logger } from '@vendure/core';
import crypto from 'crypto';
import { loggerCtx } from '../constants';

interface RawRequestInput {
  entity: 'products' | 'orders' | 'webhooks' | 'webshops';
  method: 'POST' | 'GET' | 'PUT' | 'DELETE';
  payload?: Object;
  queryParams?: string;
  pathParam?: string;
}

export interface ClientInput {
  apiKey: string;
  webshopUuid: string;
}

export class GoedgepicktClient {
  private readonly headers: Record<string, string>;

  constructor(private readonly config: ClientInput) {
    this.headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    };
  }

  /**
   * Gets paginated products. 100 products per page
   */
  async getProducts(page = 1): Promise<Product[]> {
    const result = await this.rawRequest({
      entity: 'products',
      method: 'GET',
      queryParams: `perPage=100&page=${page}`,
    });
    Logger.debug(
      `Fetched ${result.items?.length} products from Goedgepickt`,
      loggerCtx
    );
    return result.items as Product[];
  }

  /**
   * Gets all products without pagination. Stores all results in memory, so use with care
   */
  async getAllProducts(): Promise<Product[]> {
    const products: Product[] = [];
    let page = 1;
    while (true) {
      const results = await this.getProducts(page);
      if (results && Array.isArray(results)) {
        products.push(...results);
      }
      if (!results || results.length < 100) {
        break;
      }
      page++;
    }
    return products;
  }

  async getWebhooks(): Promise<Webhook[]> {
    const { items }: { items: Webhook[] } = await this.rawRequest({
      entity: 'webhooks',
      method: 'GET',
    });
    if (!items) {
      return [];
    }
    Logger.debug(
      `Fetched ${items?.length} webhooks from Goedgepickt`,
      loggerCtx
    );
    return items.filter((item) => item.webshopUuid === this.config.webshopUuid);
  }

  async createProduct(product: ProductInput): Promise<Product[]> {
    const result = await this.rawRequest({
      entity: 'products',
      method: 'POST',
      payload: product,
    });
    Logger.debug(
      `Created product ${result.items?.[0]?.uuid} in Goedgepickt`,
      loggerCtx
    );
    return result.items as Product[];
  }

  async findProductBySku(sku: string): Promise<Product | undefined> {
    const result = await this.rawRequest({
      entity: 'products',
      method: 'GET',
      queryParams: `searchAttribute=sku&searchDelimiter=%3D&searchValue=${sku}`,
    });
    const foundProduct = result.items?.[0];
    if (result.items.length > 1) {
      Logger.warn(
        `Found multiple products with sku ${sku} in Goedgepickt, using '${foundProduct.uuid}'`,
        loggerCtx
      );
    }
    return foundProduct;
  }

  async updateProduct(uuid: string, product: ProductInput): Promise<Product[]> {
    const result = await this.rawRequest({
      entity: 'products',
      method: 'PUT',
      payload: product,
      pathParam: `${uuid}`,
    });
    Logger.debug(`Updated product ${uuid} in Goedgepickt`, loggerCtx);
    return result.items as Product[];
  }

  async createWebhook(input: {
    webhookEvent: GoedgepicktEvent;
    targetUrl: string;
  }): Promise<Webhook> {
    const result = await this.rawRequest({
      entity: 'webhooks',
      method: 'POST',
      payload: input,
    });
    Logger.info(
      `Set webhook for event ${input.webhookEvent} to url ${input.targetUrl}`,
      loggerCtx
    );
    return result;
  }

  async createOrder(order: OrderInput): Promise<Order> {
    const result = await this.rawRequest({
      entity: 'orders',
      method: 'POST',
      payload: order,
    });
    Logger.info(
      `Created order ${order.orderId} in Goedgepickt with uuid ${result.orderUuid}`,
      loggerCtx
    );
    return result;
  }

  /**
   * Gets paginated products. 100 products per page
   */
  async getOrder(uuid: string): Promise<Order> {
    const result = await this.rawRequest({
      entity: 'orders',
      method: 'GET',
      pathParam: uuid,
    });
    return result as Order;
  }

  async rawRequest(input: RawRequestInput): Promise<any> {
    const queryExtension = input.queryParams ? `?${input.queryParams}` : '';
    const pathParam = input.pathParam ? `/${input.pathParam}` : '';
    const response = await fetch(
      `https://account.goedgepickt.nl/api/v1/${input.entity}${pathParam}${queryExtension}`,
      {
        method: input.method,
        headers: this.headers,
        body:
          input.payload && input.method !== 'GET'
            ? JSON.stringify({
                webshopUuid: this.config.webshopUuid,
                ...input.payload,
              })
            : undefined,
        redirect: 'follow',
      }
    );
    const json = (await response.json()) as any;
    if (response.ok) {
      return json;
    }
    throw Error(json.error || json.errorMessage || json.message);
  }
}
