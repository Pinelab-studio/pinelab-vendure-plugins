import { Injectable, OnModuleInit, Inject, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  GetTokenRespose,
  CreateShipmentResponse,
  EventPayload,
} from '../types';
import {
  EventBus,
  Logger,
  Order,
  OrderEvent,
  OrderPlacedEvent,
  OrderService,
  OrderState,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { PLUGIN_INIT_OPTIONS, loggerCtx } from '../constants';
import { ShipmatePluginConfig } from '../shipmate.plugin';
import { ShipmateConfigService } from './shipmate-config.service';
import { filter } from 'rxjs';
import { parseOrder } from './util';

export const SHIPMATE_TOKEN_HEADER_KEY = 'X-SHIPMATE-TOKEN';
export const SHIPMATE_API_KEY_HEADER_KEY = 'X-SHIPMATE-API-KEY';

@Injectable()
export class ShipmateService implements OnModuleInit {
  tokens: Map<string, string> = new Map();
  constructor(
    private httpService: HttpService,
    @Inject(PLUGIN_INIT_OPTIONS) private config: ShipmatePluginConfig,
    private shipmateConfigService: ShipmateConfigService,
    private orderService: OrderService,
    private eventBus: EventBus,
    private connection: TransactionalConnection
  ) {}

  async onModuleInit(): Promise<void> {
    this.httpService.axiosRef.defaults.headers.common[
      'Accept'
    ] = `application/json`;
    this.httpService.axiosRef.defaults.headers.common[
      'Content-Type'
    ] = `application/json`;
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async ({ ctx, order }) => {
      await this.setupRequestHeaders(ctx);
      await this.createShipment(ctx, order);
    });
    this.eventBus
      .ofType(OrderEvent)
      .pipe(
        filter(
          (event) =>
            event.type === 'updated' &&
            !!event.order.customFields?.shipmateReference
        )
      )
      .subscribe(async ({ ctx, order }) => {
        await this.setupRequestHeaders(ctx);
        await this.updateShipmate(order);
      });
  }

  async setupRequestHeaders(ctx: RequestContext) {
    const shipmateConfig = await this.shipmateConfigService.getConfig(ctx);
    if (!shipmateConfig) {
      return;
    }
    let shipmateTokenForTheCurrentChannel = this.tokens.get(
      shipmateConfig.apiKey
    );
    if (!shipmateTokenForTheCurrentChannel) {
      shipmateTokenForTheCurrentChannel = await this.getShipmentToken(
        shipmateConfig.username,
        shipmateConfig.password
      );
      this.tokens.set(shipmateConfig.apiKey, shipmateTokenForTheCurrentChannel);
    }
    this.httpService.axiosRef.defaults.headers.common[
      SHIPMATE_TOKEN_HEADER_KEY
    ] = shipmateTokenForTheCurrentChannel;
    this.httpService.axiosRef.defaults.headers.common[
      SHIPMATE_API_KEY_HEADER_KEY
    ] = shipmateConfig.apiKey;
  }

  async getShipmentToken(
    shipmateUsername: string,
    shipmatePassword: string
  ): Promise<string> {
    const response = await firstValueFrom(
      this.httpService.post<GetTokenRespose>(
        `${this.config.shipmateApiUrl}/tokens`,
        {
          username: shipmateUsername,
          password: shipmatePassword,
        }
      )
    );
    if (response.data.data?.token) {
      Logger.info('Successfully authenticated with Shipmate API', loggerCtx);
      return response.data.data.token;
    } else {
      Logger.error(response.data.message, loggerCtx);
      throw new UserInputError(response.data.message);
    }
  }

  async createShipment(ctx: RequestContext, order: Order) {
    const shipmateReference = Math.random().toString(36).substring(2, 8);
    const payload = parseOrder(order, shipmateReference);
    try {
      const result = await firstValueFrom(
        this.httpService.post<CreateShipmentResponse>(
          `${this.config.shipmateApiUrl}/shipments`,
          payload
        )
      );
      Logger.info(result.data.message, loggerCtx);
      await this.orderService.updateCustomFields(ctx, order.id, {
        ...order.customFields,
        shipmateReference,
      });
    } catch (error: any) {
      const message = error.response.data.message;
      Logger.error(message, loggerCtx);
    }
  }

  async updateShipmate(order: Order) {
    const payload = parseOrder(order, order.customFields.shipmateReference);
    try {
      const result = await firstValueFrom(
        this.httpService.put<CreateShipmentResponse>(
          `${this.config.shipmateApiUrl}/shipments/${order.customFields.shipmateReference}`,
          payload
        )
      );
      Logger.info(result.data.message, loggerCtx);
    } catch (error: any) {
      const message = error.response.data.message;
      Logger.error(message, loggerCtx);
    }
  }

  async updateOrderState(
    ctx: RequestContext,
    payload: EventPayload
  ): Promise<HttpStatus> {
    const orderRepo = this.connection.getRepository(ctx, Order);
    //Using TransactionalConnection may be an anitpattern, but not using OrderService.findOneByCode saves us the extra join queries that it does in the background
    const shipmentOrder = await orderRepo.findOne({
      where: { code: payload.order_reference },
      select: ['id'],
    });
    if (!shipmentOrder) {
      Logger.error(
        `No Order with order reference ${payload.order_reference}`,
        loggerCtx
      );
      return HttpStatus.BAD_REQUEST;
    }
    if (payload.event === 'TRACKING_COLLECTED') {
      await this.orderService.transitionToState(
        ctx,
        shipmentOrder.id,
        'Shipped'
      );
    } else if (payload.event === 'TRACKING_DELIVERED') {
      await this.orderService.transitionToState(
        ctx,
        shipmentOrder.id,
        'Delivered'
      );
    } else {
      Logger.info(
        `${payload.event} event received for Order with code ${payload.order_reference}`,
        loggerCtx
      );
    }
    return HttpStatus.OK;
  }
}
