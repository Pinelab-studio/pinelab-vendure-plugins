import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
  Channel,
  EntityHydrator,
  FulfillmentService,
  FulfillmentState,
  LanguageCode,
  Logger,
  Order,
  OrderLine,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { OrderAddress } from '@vendure/common/lib/generated-types';

import axios from 'axios';
import { Fulfillment } from '@vendure/core';
import { MyparcelConfigEntity } from './myparcel-config.entity';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import {
  MyparcelDropOffPoint,
  MyparcelDropOffPointInput,
} from '../generated/graphql';
import {
  CustomsItem,
  MyparcelConfig,
  MyParcelError,
  MyparcelShipment,
} from './types';

@Injectable()
export class MyparcelService implements OnApplicationBootstrap {
  client = axios.create({ baseURL: 'https://api.myparcel.nl/' });

  constructor(
    private fulfillmentService: FulfillmentService,
    private connection: TransactionalConnection,
    // private channelService: ChannelService,
    @Inject(PLUGIN_INIT_OPTIONS) private config: MyparcelConfig,
    private hydrator: EntityHydrator
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.syncWebhookOnStartup) {
      const defualtChannel = await this.connection.rawConnection
        .getRepository(Channel)
        .find({ where: { code: '__default_channel__' } });
      const ctx = new RequestContext({
        apiType: 'admin',
        isAuthorized: true,
        authorizedAsOwnerOnly: false,
        channel: defualtChannel[0],
      });
      // Async, because webhook setting is not really needed for application startup
      this.setWebhooksForAllChannels(ctx)
        .then(() => Logger.info(`Initialized MyParcel plugin`, loggerCtx))
        .catch((err) =>
          Logger.error(`Failed to initialized MyParcel plugin`, loggerCtx, err)
        );
    } else {
      Logger.info(
        `Initialized MyParcel plugin without syncing webhook to MyParcel`,
        loggerCtx
      );
    }
  }

  async setWebhooksForAllChannels(ctx: RequestContext): Promise<void> {
    // Create webhook subscription for all channels
    const webhook = `${this.config.vendureHost}/myparcel/update-status`;
    const configs = await this.getAllConfigs(ctx);
    await Promise.all(
      configs.map(({ channelId, apiKey }) => {
        return this.request('webhook_subscriptions', 'POST', apiKey, {
          webhook_subscriptions: [
            {
              hook: 'shipment_status_change',
              url: webhook,
            },
          ],
        })
          .then(() =>
            Logger.info(`Set webhook for ${channelId} to ${webhook}`, loggerCtx)
          )
          .catch((error: Error) =>
            Logger.error(
              `Failed to set webhook for ${channelId}`,
              loggerCtx,
              error.stack
            )
          );
      })
    );
  }

  /**
   * Upserts a MyparcelConfig. Deletes record if apiKey is null/undefined/empty string
   * @param config
   */
  async upsertConfig(
    ctx: RequestContext,
    apiKey: string
  ): Promise<MyparcelConfigEntity | null> {
    const existing = await this.connection
      .getRepository(ctx, MyparcelConfigEntity)
      .findOne({ where: { channelId: ctx.channelId as string } });
    if ((!apiKey || apiKey === '') && existing) {
      await this.connection
        .getRepository(ctx, MyparcelConfigEntity)
        .delete(existing.id);
    } else if (existing) {
      await this.connection
        .getRepository(ctx, MyparcelConfigEntity)
        .update(existing.id, { apiKey: apiKey });
    } else {
      await this.connection
        .getRepository(ctx, MyparcelConfigEntity)
        .insert({ apiKey, channelId: ctx.channelId as string });
    }
    return this.connection
      .getRepository(ctx, MyparcelConfigEntity)
      .findOne({ where: { channelId: ctx.channelId as string } });
  }

  async getDropOffPoints(
    ctx: RequestContext,
    input: MyparcelDropOffPointInput
  ): Promise<MyparcelDropOffPoint[]> {
    const config = await this.getConfig(ctx);
    if (!config || !config?.apiKey) {
      Logger.info(
        `MyParcel is not enabled for channel ${ctx.channel.token}, can not fetch dropoff points`,
        loggerCtx
      );
      return [];
    }
    const searchParams = new URLSearchParams({
      postal_code: input.postalCode,
      limit: '30',
    });
    if (input.carrierId) {
      searchParams.append('carried_id', input.carrierId);
    }
    if (input.countryCode) {
      searchParams.append('cc', input.countryCode);
    }
    const path = `drop_off_points?${searchParams.toString()}`;
    const res = await this.request(path, 'GET', config.apiKey);
    let results = res.data.drop_off_points || [];
    // FIXME because of myparcel bug: also returns other carriers
    if (input.carrierId) {
      results = results.filter((r: any) => r.carrier_id == input.carrierId);
    }
    Logger.debug(
      `Fetched ${results.length} drop off points from MyParcel for channel ${ctx.channel.token}`,
      loggerCtx
    );
    return results.slice(0, 10);
  }

  async getConfig(ctx: RequestContext): Promise<MyparcelConfigEntity | null> {
    return this.connection
      .getRepository(ctx, MyparcelConfigEntity)
      .findOne({ where: { channelId: ctx.channelId as string } });
  }

  async getConfigByKey(
    ctx: RequestContext,
    apiKey: string
  ): Promise<MyparcelConfigEntity> {
    const config = await this.connection
      .getRepository(ctx, MyparcelConfigEntity)
      .findOne({ where: { apiKey } });
    if (!config) {
      throw new MyParcelError(`No config found for apiKey ${apiKey}`);
    }
    return config;
  }

  async getAllConfigs(ctx: RequestContext): Promise<MyparcelConfigEntity[]> {
    const configs = await this.connection
      .getRepository(ctx, MyparcelConfigEntity)
      .find();
    return configs || [];
  }

  async updateStatus(
    ctx: RequestContext,
    channelId: string,
    shipmentId: string,
    status: number
  ): Promise<void> {
    const fulfillmentReference = this.getFulfillmentReference(shipmentId);
    const channel = await this.connection
      .getRepository(ctx, Channel)
      .findOneOrFail({ where: { id: ctx.channelId } });
    const fulfillment = await this.connection
      .getRepository(ctx, Fulfillment)
      .findOne({ where: { method: fulfillmentReference } });
    if (!fulfillment) {
      return Logger.warn(
        `No fulfillment found with method ${fulfillmentReference} for channel with id ${ctx.channelId}`,
        loggerCtx
      );
    }
    const fulfillmentStatus = myparcelStatusses[status];
    if (!fulfillmentStatus) {
      return Logger.info(
        `No fulfillmentStatus found for myparcelStatus ${status}, not updating fulfillment ${shipmentId}`,
        loggerCtx
      );
    }
    await this.fulfillmentService.transitionToState(
      ctx,
      fulfillment.id,
      fulfillmentStatus
    );
    Logger.info(
      `Updated fulfillment ${fulfillmentReference} to ${fulfillmentStatus}`,
      loggerCtx
    );
  }

  async createShipments(
    ctx: RequestContext,
    orders: Order[],
    customsContent: string
  ): Promise<string> {
    const config = await this.getConfig(ctx);
    if (!config) {
      throw new MyParcelError(`No config found for channel ${ctx.channelId}`);
    }
    await Promise.all(
      orders.map((order) =>
        this.hydrator.hydrate(ctx, order, {
          relations: ['customer', 'lines.productVariant.product'],
        })
      )
    );
    const shipments = this.toShipment(orders, customsContent);
    const res = await this.request('shipments', 'POST', config.apiKey, {
      shipments,
    });
    const id = res.data?.ids?.[0]?.id;
    return this.getFulfillmentReference(id);
  }

  toShipment(orders: Order[], customsContent: string): MyparcelShipment[] {
    return orders.map((order) => {
      Logger.info(`Creating shipment for ${order.code}`, loggerCtx);

      const address: OrderAddress = order.shippingAddress;
      const shipment = this.config.shipmentStrategy.getShipment(
        address,
        order,
        customsContent
      );

      if (customsContent) {
        // Set customs information
        const items = order.lines.map((line) =>
          this.getCustomsItem(line, order.currencyCode)
        );
        const totalWeight = items.reduce(
          (acc, curr) => curr.weight * curr.amount + acc,
          0
        );
        shipment.physical_properties = {
          weight: totalWeight,
        };
        shipment.customs_declaration = {
          contents: parseInt(customsContent),
          invoice: order.code,
          weight: totalWeight,
          items,
        };
      }
      return shipment;
    });
  }

  private getCustomsItem(line: OrderLine, currencyCode: string): CustomsItem {
    if (!this.config.getCustomsInformationFn) {
      throw new UserInputError(
        `No "getCustomsInformationFn" configured. Can not create customs information`
      );
    }
    const { classification, countryCodeOfOrigin, weightInGrams } =
      this.config.getCustomsInformationFn(line);
    const name =
      line.productVariant.product.translations.find(
        (t) => t.languageCode === LanguageCode.en
      )?.name || line.productVariant.product.translations[0].name;
    return {
      description: name,
      amount: line.quantity,
      weight: weightInGrams,
      item_value: {
        amount: line.proratedLinePriceWithTax,
        currency: currencyCode,
      },
      classification,
      country: countryCodeOfOrigin,
    };
  }

  private getFulfillmentReference(shipmentId: string | number): string {
    return `MyParcel ${shipmentId}`;
  }

  private async request(
    path: 'shipments' | 'webhook_subscriptions' | 'drop_off_points' | string,
    method: 'GET' | 'POST',
    apiKey: string,
    body?: unknown
  ): Promise<MyparcelResponse> {
    const shipmentContentType =
      'application/vnd.shipment+json;version=1.1;charset=utf-8';
    const defaultContentType = 'application/json';
    const contentType =
      path === 'shipments' ? shipmentContentType : defaultContentType;
    const buff = Buffer.from(apiKey);
    const encodedKey = buff.toString('base64');
    const headers = {
      Authorization: `basic ${encodedKey}`,
      'Content-Type': contentType,
      'User-Agent': 'CustomApiCall/2',
    };
    try {
      if (method === 'POST') {
        const res = await this.client.post(
          path,
          {
            data: body,
          },
          {
            headers,
          }
        );
        return res.data;
      } else {
        const res = await this.client.get(path, {
          headers,
        });
        return res.data;
      }
    } catch (err: any) {
      if (err.response?.status >= 400 && err.response?.status < 500) {
        const errorMessage = this.getReadableError(err.response.data);
        Logger.warn(err.response.data, loggerCtx);
        throw errorMessage ? new MyParcelError(errorMessage) : err;
      } else {
        Logger.warn(err.response, loggerCtx);
        throw err;
      }
    }
  }

  private getReadableError(data: MyparcelErrorResponse): string | undefined {
    const error = Object.values(data.errors?.[0] || {}).find(
      (value) => value?.human?.[0]
    );
    return error?.human?.[0];
  }
}

export interface WebhookSubscription {
  url: string;
  hook: string;
}

export interface MyparcelResponse {
  data: any;
}

export interface MyparcelErrorResponse {
  errors: MyparcelError[];
  message: string;
}

export interface MyparcelError {
  [key: string]: {
    fields: string[];
    human: string[];
  };
}

export interface MyparcelStatusChangeEvent {
  data: {
    hooks: [
      {
        shipment_id: string;
        account_id: number;
        shop_id: number;
        status: number;
        barcode: string;
        shipment_reference_identifier: string;
      }
    ];
  };
}

export const myparcelStatusses: { [key: string]: FulfillmentState } = {
  1: 'Pending',
  2: 'Pending',
  3: 'Shipped',
  4: 'Shipped',
  5: 'Shipped',
  6: 'Shipped',
  7: 'Delivered',
  8: 'Delivered',
  9: 'Delivered',
  10: 'Delivered',
  11: 'Delivered',
  32: 'Shipped',
  33: 'Shipped',
  34: 'Shipped',
  35: 'Shipped',
  36: 'Delivered',
  37: 'Delivered',
  38: 'Delivered',
  99: 'Delivered',
};
