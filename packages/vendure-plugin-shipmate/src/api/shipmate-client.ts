import { Logger } from '@vendure/core';
import axios, { AxiosInstance } from 'axios';
import { loggerCtx } from '../constants';
import {
  CreateShipmentResponse,
  DeleteShipmentResponse,
  GetTokenRespose,
  NewShipment,
  Shipment,
} from '../types';

interface ShipmateClientInput {
  apiUrl: string;
  username: string;
  password: string;
  apiKey: string;
}

export class ShipmateClient {
  client: AxiosInstance;

  /**
   * Auth token used to identify as user
   */
  private token: string | undefined;

  constructor(private input: ShipmateClientInput) {
    this.client = axios.create({
      headers: {
        'X-SHIPMATE-API-KEY': input.apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      baseURL: input.apiUrl,
    });
  }

  async createShipment(shipment: Shipment): Promise<NewShipment[] | undefined> {
    try {
      await this.setToken();
      const result = await this.client.post<CreateShipmentResponse>(
        `/shipments`,
        shipment
      );
      Logger.info(result.data.message, loggerCtx);
      return result.data?.data;
    } catch (error) {
      this.handleShipmateAPIError(error);
    }
  }

  async cancelShipment(shipment_reference: string): Promise<void> {
    try {
      await this.setToken();
      const result = await this.client.delete<DeleteShipmentResponse>(
        `/shipments/${shipment_reference}`
      );
      Logger.info(result.data.message, loggerCtx);
    } catch (error) {
      this.handleShipmateAPIError(error);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleShipmateAPIError(error: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    Logger.error(JSON.stringify(error.response?.data), loggerCtx);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (error.response?.data) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      throw Error(JSON.stringify(error.response.data));
    }
    throw error;
  }

  async getShipmentToken(
    shipmateUsername: string,
    shipmatePassword: string
  ): Promise<string> {
    const response = await this.client.post<GetTokenRespose>(`/tokens`, {
      username: shipmateUsername,
      password: shipmatePassword,
    });
    if (!response.data.data?.token) {
      Logger.error(
        response.data.message,
        loggerCtx,
        JSON.stringify(response.data)
      );
      throw new Error(response.data.message);
    }
    return response.data.data.token;
  }

  /**
   * Get a token to authenticate as given user, and set it as header in our axios instance
   */
  private async setToken(): Promise<void> {
    if (!this.token) {
      this.token = await this.getShipmentToken(
        this.input.username,
        this.input.password
      );
    }
    this.client.defaults.headers.common['X-SHIPMATE-TOKEN'] = this.token;
  }
}
