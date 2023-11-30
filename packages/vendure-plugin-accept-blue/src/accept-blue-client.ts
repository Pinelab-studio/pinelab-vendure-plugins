import axios, { AxiosInstance } from 'axios';
import { loggerCtx } from './constants';
import { Customer } from './types';

export class AcceptBlueClient {
  readonly endpoint: string;
  readonly instance: AxiosInstance;

  constructor(
    public readonly apiKey: string,
    public readonly pin: string = '',
    readonly testMode: boolean = false
  ) {
    if (testMode) {
      this.endpoint = 'https://test.accept.blue/api/v1';
      console.warn(`Using Accept Blue in test mode`, loggerCtx);
    } else {
      this.endpoint = 'https://api.develop.accept.blue/api/v2/';
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

  async getOrCreateCustomer(emailAddress: string): Promise<Customer> {
    const existing = await this.getCustomer(emailAddress);
    if (existing) {
      return existing;
    } else {
      return await this.createCustomer(emailAddress);
    }
  }

  async getCustomer(emailAddress: string): Promise<Customer> {
    return await this.request('get', `customers/${emailAddress}`);
  }

  async createCustomer(emailAddress: string): Promise<Customer> {
    const customer: Customer = {
      identifier: emailAddress,
      customer_number: emailAddress,
      email: emailAddress,
      active: true,
    };
    const result = await this.request('post', 'customers', customer);
    console.log(`Created new customer ${emailAddress}`, loggerCtx);
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
      console.error(`${result.status} ${result.statusText}`, loggerCtx);
      throw Error(result.statusText);
    }
    return result.data;
  }
}
