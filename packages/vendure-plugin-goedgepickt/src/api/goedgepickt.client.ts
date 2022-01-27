import fetch from 'node-fetch';
import {
  ClientConfig,
  Order,
  OrderInput,
  Product,
  ProductInput,
} from './goedgepickt.types';
import { Logger } from '@vendure/core';
import crypto from 'crypto';
import { loggerCtx } from '../constants';

interface RawRequestInput {
  entity: 'products' | 'orders';
  method: 'POST' | 'GET' | 'PUT' | 'DELETE';
  payload?: Object;
  queryParams?: string;
}

export class GoedgepicktClient {
  private readonly headers: Record<string, string>;

  constructor(private readonly config: ClientConfig) {
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
    Logger.info(
      `Fetched ${result.items?.length} products from Goedgepickt`,
      loggerCtx
    );
    return result.items as Product[];
  }

  async createProduct(product: ProductInput): Promise<Product[]> {
    const result = await this.rawRequest({
      entity: 'products',
      method: 'POST',
      payload: product,
    });
    Logger.info(
      `Created product ${product.productId} in Goedgepickt`,
      loggerCtx
    );
    return result.items as Product[];
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

  validateOrderWebhookSignature(data: string, incomingSignature: string): void {
    return this.validateSignature(
      data,
      this.config.orderWebhookKey,
      incomingSignature
    );
  }

  validateStockWebhookSignature(data: string, incomingSignature: string): void {
    return this.validateSignature(
      data,
      this.config.stockWebhookKey,
      incomingSignature
    );
  }

  private validateSignature(
    data: string,
    secret: string,
    incomingSignature: string
  ): void {
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
    if (computedSignature !== incomingSignature) {
      Logger.warn(
        `Incoming event has an invalid signature! ${data}`,
        loggerCtx
      );
      throw Error(`Invalid signature.`);
    }
  }
}
