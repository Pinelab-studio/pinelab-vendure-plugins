import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import {
  GetTokenRespose,
  CreateShipmentResponse,
  EventPayload,
  TrackingEventPayload,
} from '../types';
import {
  Channel,
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
import { FulfillOrderInput } from '@vendure/common/lib/generated-types';
import axios, { AxiosInstance } from 'axios';
import { ShipmateConfigEntity } from './shipmate-config.entity';
import { ShipmateClient } from './shipmate-client';

export const SHIPMATE_TOKEN_HEADER_KEY = 'X-SHIPMATE-TOKEN';
export const SHIPMATE_API_KEY_HEADER_KEY = 'X-SHIPMATE-API-KEY';

@Injectable()
export class ShipmateService implements OnModuleInit {
  tokens: Map<string, string> = new Map();
  constructor(
    @Inject(PLUGIN_INIT_OPTIONS) private config: ShipmatePluginConfig,
    private shipmateConfigService: ShipmateConfigService,
    private orderService: OrderService,
    private eventBus: EventBus,
    private connection: TransactionalConnection,
    private entityHydrator: EntityHydrator
  ) {}

  async onModuleInit(): Promise<void> {
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async ({ ctx, order }) => {
      const headers = await this.getShipmateAuthHeaders(ctx);
      if (headers) {
        await this.createShipment(ctx, order, headers);
      }
    });
  }

  async getShipmateAuthHeaders(ctx: RequestContext): Promise<any> {
    const shipmateConfig = await this.shipmateConfigService.getConfig(ctx);
    if (!shipmateConfig) {
      Logger.error(
        `Shipmate credentials not configured for channel ${ctx.channel.code}`,
        loggerCtx
      );
      return;
    }
    const key = this.tokeStoreKey(shipmateConfig);
    let shipmateTokenForTheCurrentChannel = this.tokens.get(key);
    if (!shipmateTokenForTheCurrentChannel) {
      shipmateTokenForTheCurrentChannel = await this.getShipmentToken(
        shipmateConfig.username,
        shipmateConfig.password
      );
      this.tokens.set(key, shipmateTokenForTheCurrentChannel);
    }
    return {
      'X-SHIPMATE-TOKEN': shipmateTokenForTheCurrentChannel,
      'X-SHIPMATE-API-KEY': shipmateConfig.apiKey,
    };
  }

  tokeStoreKey(shipmateConfig: ShipmateConfigEntity) {
    return `${shipmateConfig.apiKey}-${shipmateConfig.channelId}`;
  }

  async getShipmentToken(
    shipmateUsername: string,
    shipmatePassword: string
  ): Promise<string> {
    const client = axios.create({
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    const response = await client.post<GetTokenRespose>(
      `${this.config.shipmateApiUrl}/tokens`,
      {
        username: shipmateUsername,
        password: shipmatePassword,
      }
    );
    if (response.data.data?.token) {
      Logger.info('Successfully authenticated with Shipmate API', loggerCtx);
      return response.data.data.token;
    } else {
      Logger.error(response.data.message, loggerCtx);
      throw new UserInputError(response.data.message);
    }
  }

  async createShipment(ctx: RequestContext, order: Order, headers: any) {
    const payload = parseOrder(order, order.code);
    const client = new ShipmateClient(headers, this.config.shipmateApiUrl);
    const newShipments = await client.createShipment(payload);
    if (newShipments?.length) {
      await this.orderService.updateCustomFields(ctx, order.id, {
        ...order.customFields,
        shipmateReference: order.code,
      });
    }
  }

  async updateOrderState(payload: EventPayload): Promise<string> {
    const ctx = await this.createCtx(payload.auth_token);
    if (!ctx) {
      const message = `No registered ShipmentConfigEntity with this auth_token`;
      Logger.error(message, loggerCtx);
      throw new UserInputError(message);
    }
    const shipmentOrder = await this.orderService.findOneByCode(
      ctx,
      payload.order_reference
    );
    if (!shipmentOrder) {
      const message = `No Order with code ${payload.order_reference} in channel ${ctx.channel.code}`;
      Logger.error(message, loggerCtx);
      throw new UserInputError(message);
    }
    Logger.info(
      `${payload.event} event received for Order with code ${payload.order_reference} in channel ${ctx.channel.code}`,
      loggerCtx
    );
    if (payload.event === 'TRACKING_COLLECTED') {
      await this.updateFulFillment(ctx, shipmentOrder, payload, 'Shipped');
      return `Order successfully marked as  Shipped`;
    } else if (payload.event === 'TRACKING_DELIVERED') {
      await this.updateFulFillment(ctx, shipmentOrder, payload, 'Delivered');
      return `Order successfully marked as Delivered`;
    } else {
      Logger.info(
        `No configured handler for event "${payload.event}"`,
        loggerCtx
      );
    }
    return `No configured handler for event "${payload.event}"`;
  }

  /**
   * Update Vedure Fulfillments
   */
  async updateFulFillment(
    ctx: RequestContext,
    order: Order,
    payload: EventPayload,
    state: FulfillmentState
  ) {
    await this.entityHydrator.hydrate(ctx, order, {
      relations: ['fulfillments'],
    });
    if (!order.fulfillments?.length) {
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

  /**
   * Create Vedure Fulfillments
   */
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
      Logger.error(`No channel with this webhooks auth token`, loggerCtx);
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
