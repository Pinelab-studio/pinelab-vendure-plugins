import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
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
  OrderLine,
  OrderPlacedEvent,
  RequestContext,
  UserInputError,
} from '@vendure/core';
import { loggerCtx } from '../constants';
import { OrderAddress } from '@vendure/common/lib/generated-types';

export const SHIPMATE_TOKEN_HEADER_KEY = 'X-SHIPMATE-TOKEN';
export const SHIPMATE_API_KEY_HEADER_KEY = 'X-SHIPMATE-API-KEY';

@Injectable()
export class ShipmateService implements OnModuleInit, OnModuleDestroy {
  tokens: Map<string, string> = new Map();
  constructor(private httpService: HttpService, private eventBus: EventBus) {}
  async onModuleDestroy() {
    if (
      this.httpService.axiosRef.defaults.headers.common[
        SHIPMATE_TOKEN_HEADER_KEY
      ]
    ) {
      await firstValueFrom(
        this.httpService.delete(`${process.env.SHIPMATE_BASE_URL}/tokens`)
      );
    }
  }

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
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async ({ ctx, order }) => {
      let shipmateTokenForTheCurrentChannel = this.tokens.get(
        process.env.SHIPMATE_API_KEY as string
      );
      if (!shipmateTokenForTheCurrentChannel) {
        shipmateTokenForTheCurrentChannel = await this.getShipmentToken();
        this.tokens.set(
          process.env.SHIPMATE_API_KEY as string,
          shipmateTokenForTheCurrentChannel
        );
      }
      this.httpService.axiosRef.defaults.headers.common[
        SHIPMATE_TOKEN_HEADER_KEY
      ] = shipmateTokenForTheCurrentChannel;
      await this.createShipment(ctx, order);
    });
  }

  async getShipmentToken(): Promise<string> {
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
      Logger.info('Successfully authenticated with Shipmate API', loggerCtx);
      return response.data.data.token;
    } else {
      Logger.error(response.data.message, loggerCtx);
      throw new UserInputError(response.data.message);
    }
  }

  async createShipment(ctx: RequestContext, order: Order) {
    const payload = this.parseOrder(order);
    console.log(payload, 'payload');
    try {
      const result = await firstValueFrom(
        this.httpService.post<CreateShipmentResponse>(
          `${process.env.SHIPMATE_BASE_URL}/shipments`,
          payload
        )
      );
      console.log(result.data.data);
      Logger.info(result.data.message, loggerCtx);
    } catch (error: any) {
      console.log(error.response.data.data);
      return;
    }
  }

  parseOrder(order: Order): Shipment {
    return {
      shipment_reference: Math.random().toString(36).substring(2, 8),
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
      telephone: '+251921733550', //address.phoneNumber??'+251921733550',
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
