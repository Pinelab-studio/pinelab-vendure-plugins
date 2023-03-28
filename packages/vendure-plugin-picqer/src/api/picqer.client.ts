import axios, { AxiosInstance } from 'axios';

export interface PicqerClientInput {
  apiEndpoint: string;
  apiKey: string;
  storefrontUrl: string;
  supportEmail: string;
}
axios.interceptors.request.use((request) => {
  console.log('Starting Request', JSON.stringify(request, null, 2));
  return request;
});

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
        'User-Agent': `MyPicqerClient (${storefrontUrl} - ${supportEmail})`,
      },
    });
  }

  async getStats(): Promise<any> {
    return this.instance.get('stats');
  }
}
