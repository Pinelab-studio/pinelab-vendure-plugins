import { AxiosInstance, AxiosResponse } from 'axios';
import { ChargeInput, ChargeResult } from './coinbase.types';
import { Logger } from '@vendure/core';
import { loggerCtx } from './constants';
const axios = require('axios').default;

export class CoinbaseClient {
  private readonly client: AxiosInstance;

  constructor(private config: { apiKey: string; apiVersion?: string }) {
    this.config.apiVersion = this.config.apiVersion || '2018-03-22';
    this.client = axios.create({
      baseURL: 'https://api.commerce.coinbase.com',
    });
    this.client.defaults.headers.common['Content-Type'] = 'application/json';
    this.client.defaults.headers.common['X-CC-Api-Key'] = this.config.apiKey;
    this.client.defaults.headers.common['X-CC-Version'] =
      this.config.apiVersion;
  }

  async createCharge(input: ChargeInput): Promise<ChargeResult> {
    const result = await this.client.post('/charges', input);
    return this.validateResponse(result);
  }

  async getCharge(id: string): Promise<ChargeResult> {
    const result = await this.client.get(`/charges/${id}`);
    return this.validateResponse(result);
  }

  private validateResponse(result: AxiosResponse): any {
    if (result.data.error) {
      Logger.error(
        `Coinbase call failed: ${result.data.error?.message}`,
        loggerCtx,
      );
      throw Error(result.data.error?.message);
    }
    return result.data;
  }
}
