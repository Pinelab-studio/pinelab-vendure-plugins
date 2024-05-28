import { Injectable, OnModuleInit, Inject, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  GetTokenRespose,
  CreateShipmentResponse,
  EventPayload,
  TrackingEventPayload,
} from '../types';
import {
  Channel,
  ChannelService,
  EntityHydrator,
  EventBus,
  FulfillmentState,
  Logger,
  Order,
  OrderPlacedEvent,
  OrderService,
  RequestContext,
  TransactionalConnection,
  UserInputError,
  isGraphQlErrorResult,
  manualFulfillmentHandler,
} from '@vendure/core';
import { PLUGIN_INIT_OPTIONS, loggerCtx } from '../constants';
import { ShipmatePluginConfig } from '../shipmate.plugin';
import { ShipmateConfigService } from './shipmate-config.service';
import { parseOrder } from './util';
import { generatePublicId } from '@vendure/core/dist/common/generate-public-id';
import { FulfillOrderInput } from '@vendure/common/lib/generated-types';
import { Response } from 'express';

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
    private connection: TransactionalConnection,
    private entityHydrator: EntityHydrator
  ) {}

  async onModuleInit(): Promise<void> {
    this.httpService.axiosRef.defaults.headers.common['Accept'] =
      'application/json';
    this.httpService.axiosRef.defaults.headers.common['Content-Type'] =
      'application/json';
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async ({ ctx, order }) => {
      await this.setupRequestHeaders(ctx);
      await this.createShipment(ctx, order);
    });
  }

  async setupRequestHeaders(ctx: RequestContext) {
    const shipmateConfig = await this.shipmateConfigService.getConfig(ctx);
    if (!shipmateConfig) {
      Logger.error(
        `Shipmate credentials not configured for channel ${ctx.channel.code}`,
        loggerCtx
      );
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
    const shipmateReference = generatePublicId();
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

  async updateOrderState(payload: EventPayload, res: Response): Promise<void> {
    const ctx = await this.createCtx(payload.auth_token);
    if (!ctx) {
      const message = `No registered ShipmentConfigEntity with this auth_token`;
      Logger.error(message, loggerCtx);
      res.status(HttpStatus.BAD_REQUEST).json({ message });
      return;
    }
    await this.connection.startTransaction(ctx);
    const shipmentOrder = await this.orderService.findOneByCode(
      ctx,
      payload.order_reference
    );
    if (!shipmentOrder) {
      const message = `No Order with code ${payload.order_reference}`;
      Logger.error(message, loggerCtx);
      res.status(HttpStatus.BAD_REQUEST).json({ message });
      return;
    }
    Logger.info(
      `${payload.event} event received for Order with code ${payload.order_reference}`,
      loggerCtx
    );
    if (payload.event === 'TRACKING_COLLECTED') {
      await this.updateFulFillment(ctx, shipmentOrder, payload, 'Shipped');
      res
        .status(HttpStatus.CREATED)
        .json({ message: `Order state updated to Shipped successfully` });
    } else if (payload.event === 'TRACKING_DELIVERED') {
      await this.updateFulFillment(ctx, shipmentOrder, payload, 'Delivered');
      res
        .status(HttpStatus.CREATED)
        .json({ message: `Order state updated to Delivered successfully` });
    } else {
      Logger.info(
        `No configured handler for event "${payload.event}"`,
        loggerCtx
      );
    }
    await this.connection.commitOpenTransaction(ctx);
    return;
  }

  async updateFulFillment(
    ctx: RequestContext,
    order: Order,
    payload: EventPayload,
    state: FulfillmentState
  ) {
    await this.entityHydrator.hydrate(ctx, order, {
      relations: ['fulfillments'],
    });
    if (!order.fulfillments.length) {
      const fulfillmentInputs = this.createFulfillOrderInput(order, payload);
      const createFulfillmentResult = await this.orderService.createFulfillment(
        ctx,
        fulfillmentInputs
      );
      if (isGraphQlErrorResult(createFulfillmentResult)) {
        Logger.info(
          `Unable to create Fulfillment for order ${order.code}: ${createFulfillmentResult.message}`,
          loggerCtx
        );
        throw createFulfillmentResult.message;
      }
      const transitionResult =
        await this.orderService.transitionFulfillmentToState(
          ctx,
          createFulfillmentResult.id,
          state
        );
      if (isGraphQlErrorResult(transitionResult)) {
        Logger.info(
          `Unable to transition Fulfillment ${createFulfillmentResult.id} to ${state}: ${transitionResult.transitionError}`,
          loggerCtx
        );
        throw transitionResult.transitionError;
      }
      await this.entityHydrator.hydrate(ctx, order, {
        relations: ['fulfillments'],
      });
    }
    for (const fulfillment of order.fulfillments) {
      const transitionResult =
        await this.orderService.transitionFulfillmentToState(
          ctx,
          fulfillment.id,
          state
        );
      if (isGraphQlErrorResult(transitionResult)) {
        Logger.info(
          `Unable to transition Fulfillment ${fulfillment.id} to ${state}: ${transitionResult.transitionError}`,
          loggerCtx
        );
        throw transitionResult.transitionError;
      }
    }
  }

  createFulfillOrderInput(
    order: Order,
    payload: EventPayload
  ): FulfillOrderInput {
    return {
      handler: {
        arguments: [
          { name: 'method', value: manualFulfillmentHandler.code },
          {
            name: 'trackingCode',
            value: (payload as TrackingEventPayload).tracking_number,
          },
        ],
        code: manualFulfillmentHandler.code,
      },
      lines: order.lines.map((line) => {
        return {
          orderLineId: line.id,
          quantity: line.quantity,
        };
      }),
    };
  }

  private async createCtx(
    authToken: string
  ): Promise<RequestContext | undefined> {
    const config =
      await this.shipmateConfigService.getConfigWithWebhookAuthToken(authToken);
    if (!config) {
      Logger.info(`No channel with this webhooks auth token`, loggerCtx);
      return;
    }
    const channel = (await this.connection.getRepository(Channel).findOne({
      where: { id: config.channelId },
      relations: ['defaultTaxZone', 'defaultShippingZone'],
    })) as Channel;
    return new RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      channel,
    });
  }
}
