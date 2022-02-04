import fetch from 'node-fetch';
import {
  GoedgepicktEvent,
  Order,
  OrderInput,
  Product,
  ProductInput,
  Webhook,
  Webshop,
} from './goedgepickt.types';
import { Logger } from '@vendure/core';
import crypto from 'crypto';
import { loggerCtx } from '../constants';

interface RawRequestInput {
  entity: 'products' | 'orders' | 'webhooks' | 'webshops';
  method: 'POST' | 'GET' | 'PUT' | 'DELETE';
  payload?: Object;
  queryParams?: string;
}

interface ClientInput {
  apiKey: string;
  webshopUuid: string;
  orderWebhookKey?: string;
  stockWebhookKey?: string;
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

  async getWebhooks(): Promise<Webhook[]> {
    const { items }: { items: Webhook[] } = await this.rawRequest({
      entity: 'webhooks',
      method: 'GET',
    });
    Logger.debug(
      `Fetched ${items.length} webhooks from Goedgepickt`,
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
      `Created product ${product.productId} in Goedgepickt`,
      loggerCtx
    );
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

  async rawRequest(input: RawRequestInput): Promise<any> {
    const queryExtension = input.queryParams ? `?${input.queryParams}` : '';
    const result = await fetch(
      `https://account.goedgepickt.nl/api/v1/${input.entity}${queryExtension}`,
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
    const json = (await result.json()) as any;
    if (json.error || json.errorMessage || json.errors) {
      const errorMessage = json.error ?? json.errorMessage ?? json.message; // If json.errors, then there should also be a message
      Logger.warn(json, loggerCtx);
      throw Error(errorMessage);
    }
    return json;
  }

  validateOrderWebhookSignature(data: Object, incomingSignature: string): void {
    return this.validateSignature({
      data,
      secret: this.config.orderWebhookKey,
      incomingSignature,
    });
  }

  validateStockWebhookSignature(data: Object, incomingSignature: string): void {
    return this.validateSignature({
      data,
      secret: this.config.stockWebhookKey,
      incomingSignature,
    });
  }

  private validateSignature(input: {
    data: Object;
    secret?: string;
    incomingSignature: string;
  }): void {
    if (!input.secret) {
      Logger.warn(
        `No secret was configured to check incoming webhooks ${input.data}`,
        loggerCtx
      );
      throw Error(`Invalid signature.`);
    }
    const computedSignature = GoedgepicktClient.computeSignature(
      input.secret,
      input.data
    );
    if (computedSignature !== input.incomingSignature) {
      Logger.warn(
        `Incoming event has an invalid signature! ${input.data}`,
        loggerCtx
      );
      throw Error(`Invalid signature.`);
    }
  }

  static computeSignature(secret: string, data: Object): string {
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(data))
      .digest('hex');
  }
}
