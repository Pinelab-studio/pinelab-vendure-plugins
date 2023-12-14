import { Logger } from '@vendure/core';
import axios, { AxiosInstance } from 'axios';
import { loggerCtx } from '../constants';
import {
  CreditCardPaymentMethodInput,
  AcceptBlueCustomer,
  AcceptBluePaymentMethod,
} from '../types';

export class AcceptBlueClient {
  readonly endpoint: string;
  readonly instance: AxiosInstance;

  constructor(
    public readonly apiKey: string,
    public readonly pin: string = ''
  ) {
    if (process.env.ACCEPT_BLUE_TEST_MODE === 'true') {
      this.endpoint = 'https://api.develop.accept.blue/api/v2/';
      Logger.warn(`Using Accept Blue in test mode`, loggerCtx);
    } else {
      this.endpoint = 'https://api.accept.blue/api/v2/';
    }
    this.instance = axios.create({
      baseURL: `${this.endpoint}`,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(
          `${this.apiKey}:${this.pin}`
        ).toString('base64')}`,
      },
      validateStatus: () => true,
    });
  }

  async getOrCreateCustomer(emailAddress: string): Promise<AcceptBlueCustomer> {
    const existingCustomers = await this.getCustomer(emailAddress);
    const existing = existingCustomers.find((c) => c.email === emailAddress);
    if (existing) {
      return existing;
    } else {
      return await this.createCustomer(emailAddress);
    }
  }

  async getCustomer(emailAddress: string): Promise<AcceptBlueCustomer[]> {
    return await this.request(
      'get',
      `customers?active=true&customer_number=${emailAddress}`
    );
  }

  async createCustomer(emailAddress: string): Promise<AcceptBlueCustomer> {
    const customer: AcceptBlueCustomer = {
      identifier: emailAddress,
      customer_number: emailAddress,
      email: emailAddress,
      active: true,
    };
    const result = await this.request('post', 'customers', customer);
    Logger.info(`Created new customer ${emailAddress}`, loggerCtx);
    return result;
  }

  async getOrPaymentMethod(
    customerId: string,
    input: CreditCardPaymentMethodInput
  ): Promise<AcceptBluePaymentMethod> {
    const methods = await this.getPaymentMethods(customerId);
    const existing = methods.find(
      (m) => m.last4 && input.card.endsWith(m.last4)
    );
    if (existing) {
      return existing;
    } else {
      return await this.createPaymentMethod(customerId, input);
    }
  }

  async getPaymentMethods(
    customerId: string
  ): Promise<AcceptBluePaymentMethod[]> {
    return await this.request('get', `customers/${customerId}/payment_methods`);
  }

  async createPaymentMethod(
    customerId: string,
    input: CreditCardPaymentMethodInput
  ): Promise<AcceptBluePaymentMethod> {
    const result: AcceptBluePaymentMethod = await this.request(
      'post',
      `customers/${customerId}/payment_methods`,
      input
    );
    Logger.info(
      `Created new payment method '${result.id}' for customer '${result.customer_id}'`,
      loggerCtx
    );
    return result;
  }

  async request(
    method: 'get' | 'post',
    path: string,
    data?: any
  ): Promise<any | undefined> {
    const result = await this.instance[method](`/${path}`, data);
    if (result.status === 404) {
      return undefined;
    }
    if (result.status >= 400) {
      Logger.error(
        `${method} to "${path}" resulted in: ${result.status} ${result.statusText}`,
        loggerCtx
      );
      throw Error(result.statusText);
    }
    return result.data;
  }
}
