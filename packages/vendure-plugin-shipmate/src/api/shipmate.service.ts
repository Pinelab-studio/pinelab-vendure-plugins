import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  GetTokenRespose,
  Items,
  Parcels,
  ShipmateAddress,
  Shipment,
  CreateShipmentResponse,
} from '../types';
import {
  Customer,
  EventBus,
  Logger,
  Order,
  OrderEvent,
  OrderLine,
  OrderPlacedEvent,
  OrderService,
  RequestContext,
  UserInputError,
} from '@vendure/core';
import { PLUGIN_INIT_OPTIONS, loggerCtx } from '../constants';
import { OrderAddress } from '@vendure/common/lib/generated-types';
import { ShipmatePluginConfig } from '../shipmate.plugin';
import { ShipmateConfigService } from './shipmate-config.service';
import { filter } from 'rxjs';

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
    private eventBus: EventBus
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
    const payload = this.parseOrder(order, shipmateReference);
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
    const payload = this.parseOrder(
      order,
      order.customFields.shipmateReference
    );
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

  parseOrder(order: Order, shipmateReference: string): Shipment {
    return {
      shipment_reference: shipmateReference,
      order_reference: order.code,
      to_address: this.parseAddress(order.shippingAddress, order.customer),
      parcels: [this.parseParcels(order)],
      delivery_instructions: '',
      print_labels: false,
    };
  }

  parseAddress(address: OrderAddress, customer?: Customer): ShipmateAddress {
    return {
      name: this.getRecepientName(
        address.fullName,
        customer?.firstName,
        customer?.lastName
      ),
      company_name: address.company ?? '',
      telephone: customer?.phoneNumber ?? '',
      email_address: customer?.emailAddress ?? '',
      line_1: address?.streetLine1 ?? '',
      line_2: address?.streetLine2 ?? '',
      line_3: '',
      city: address?.city ?? '',
      county: address.province ?? '',
      postcode: address.postalCode ?? '',
      country: address.countryCode ?? '',
    };
  }

  parseParcels(order: Order): Parcels {
    return {
      reference: Math.random().toString(36).substring(2, 8),
      value: `${order.totalWithTax / 100}`,
      items: order.lines.map((line) => this.parseOrderLine(line)),
      weight: 30,
      width: 20,
      length: 10,
      depth: 10,
    };
  }

  parseOrderLine(line: OrderLine): Items {
    return {
      item_quantity: line.quantity,
      item_value: line.proratedUnitPriceWithTax,
    };
  }

  getRecepientName(
    fullName?: string,
    customerFirstName?: string,
    customerLastName?: string
  ) {
    if (fullName) {
      return fullName;
    }
    if (customerFirstName && customerLastName) {
      return `${customerFirstName} ${customerLastName}`;
    }
    return '';
  }
}
