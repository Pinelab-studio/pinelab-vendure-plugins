import { RequestContext, Order, Logger } from '@vendure/core';
import { loggerCtx } from '../constants';
import { CreateShipmentResponse, NewShipment, Shipment } from '../types';
import { parseOrder } from './util';
import axios, { AxiosInstance } from 'axios';

export class ShipmateClient {
  client: AxiosInstance;

  constructor(headers: any, baseURL: string) {
    this.client = axios.create({
      headers: {
        ...headers,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      baseURL,
    });
  }
  async createShipment(payload: Shipment): Promise<NewShipment[] | undefined> {
    try {
      const result = await this.client.post<CreateShipmentResponse>(
        `/shipments`,
        payload
      );
      Logger.info(result.data.message, loggerCtx);
      return result.data?.data;
    } catch (error: any) {
      Logger.error(JSON.stringify(error.response?.data), loggerCtx);
    }
  }
}
