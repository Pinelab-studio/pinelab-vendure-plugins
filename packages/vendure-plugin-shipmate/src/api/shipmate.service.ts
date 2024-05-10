import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { GetTokenRespose } from '../types';
import { Logger, UserInputError } from '@vendure/core';
import { loggerCtx } from '../constants';

export const SHIPMATE_TOKEN_HEADER_KEY = 'X-SHIPMATE-TOKEN';
export const SHIPMATE_API_KEY_HEADER_KEY = 'X-SHIPMATE-API-KEY';

@Injectable()
export class ShipmateService implements OnModuleInit {
  constructor(private httpService: HttpService) {}

  async onModuleInit(): Promise<void> {
    this.httpService.axiosRef.defaults.headers.common[
      SHIPMATE_API_KEY_HEADER_KEY
    ] = process.env.SHIPMATE_API_KEY;
    this.httpService.axiosRef.defaults.headers.common[
      'Accept'
    ] = `application/json`;
    this.httpService.axiosRef.defaults.headers.common[
      'Content-Type'
    ] = `application/json`;
    if (
      !this.httpService.axiosRef.defaults.headers.common[
        SHIPMATE_TOKEN_HEADER_KEY
      ]
    ) {
      await this.getShipmentToken();
    }
  }

  async getShipmentToken() {
    const response = await firstValueFrom(
      this.httpService.post<GetTokenRespose>(
        `${process.env.SHIPMATE_BASE_URL}/tokens`,
        {
          username: process.env.SHIPMATE_USERNAME,
          password: process.env.SHIPMATE_PASSWORD,
        }
      )
    );
    if (response.data.data?.token) {
      this.httpService.axiosRef.defaults.headers.common[
        SHIPMATE_TOKEN_HEADER_KEY
      ] = response.data.data.token;
      Logger.info('Successfully authenticated with Shipmate API', loggerCtx);
    } else {
      Logger.error(response.data.message, loggerCtx);
      throw new UserInputError(response.data.message);
    }
  }
}
