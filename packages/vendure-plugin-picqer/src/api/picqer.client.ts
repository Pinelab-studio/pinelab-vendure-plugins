import axios, { AxiosInstance } from 'axios';
import { PicqerProductInput } from './types';

export interface PicqerClientInput {
  apiEndpoint: string;
  apiKey: string;
  storefrontUrl: string;
  supportEmail: string;
}

export class PicqerClient {
  readonly instance: AxiosInstance;

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
    return this.instance.get('stats');
  }

  // TODO handle errors: data.error_message

  async createProduct(input: PicqerProductInput): Promise<any> {
    return this.instance.post('/products', input);
  }
}
