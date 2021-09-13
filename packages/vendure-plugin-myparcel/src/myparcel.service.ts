import { MyparcelPlugin } from './myparcel.plugin';
import { FulfillmentService, Logger, Order, FulfillmentState } from "@vendure/core";
import {Connection} from 'typeorm';
import {OrderAddress} from '@vendure/common/lib/generated-types';
import { ApolloError } from 'apollo-server-core';
import axios from 'axios';
import {Injectable} from '@nestjs/common'
import { Fulfillment } from "@vendure/core/dist/entity/fulfillment/fulfillment.entity";

@Injectable()
export class MyparcelService {

  client = axios.create({
    baseURL: 'https://api.myparcel.nl/',
    headers: {
      'Content-Type': 'application/vnd.shipment+json;version=1.1;charset=utf-8',
    },
  });

  constructor(private fulfillmentService: FulfillmentService, private connection: Connection) {
  }

  async updateStatus(shipmentId: string, status: number): Promise<void> {
    // Get by myparcel ID
    // Updat to next state
    const fulfillment = await this.connection.getRepository(Fulfillment).findOne({trackingCode: `MyParcel ${shipmentId}`});
    if (! fulfillment) {
      return Logger.error(`No fulfillment found with id ${shipmentId}`, MyparcelPlugin.loggerCtx);
    }
    const fulfillmentStatus = myparcelStatusses[status];
    if (!fulfillmentStatus) {
      return Logger.info(`No fulfillmentStatus found for myparcelStatus ${status}, not updating fulfillment ${shipmentId}`, MyparcelPlugin.loggerCtx);
    }
    // this.fulfillmentService.transitionToState()
  }

  async createShipments(
    channelToken: string,
    orders: Order[]
  ): Promise<string | undefined> {
    const shipments = this.toShipment(orders);
    const res = await this.post<any>('shipments', { shipments }, channelToken);
    const id =  res.data?.ids?.[0]?.id as string;
    if (id) {
      return `MyParcel ${id}`;
    }
  }

  toShipment(orders: Order[]): MyparcelShipment[] {
    return orders.map((order) => {
      Logger.info(
        `Creating shipment for ${order.code}`,
        MyparcelPlugin.loggerCtx
      );
      const address: OrderAddress = order.shippingAddress;
      const [nr, nrSuffix] = this.getHousenumber(address.streetLine2!);
      return {
        carrier: 1, // PostNL
        reference_identifier: order.code,
        options: {
          package_type: 1, // Parcel
          label_description: order.code,
        },
        recipient: {
          cc: address.countryCode!,
          region: address.province || undefined,
          city: address.city!,
          street: address.streetLine1!,
          number: nr,
          number_suffix: nrSuffix,
          postal_code: address.postalCode!,
          person: address.fullName!,
          phone: address.phoneNumber || undefined,
          email: order.customer?.emailAddress,
        },
      };
    });
  }

  async post<T>(
    path: string,
    body: unknown,
    channelToken: string
  ): Promise<T> {
    const apiKey = MyparcelPlugin.apiKeys[channelToken];
    if (!apiKey) {
      throw new MyParcelError(`No apiKey found for channel ${channelToken}`);
    }
    let buff = Buffer.from(apiKey);
    let encodedKey = buff.toString('base64');
    this.client.defaults.headers['Authorization'] = `basic ${encodedKey}`;
    try {
      const res = await this.client.post(path, {
        data: body,
      });
      return res.data;
    } catch (err) {
      if (err.response?.status >= 400 && err.response?.status < 500) {
        const errorMessage = this.getReadableError(err.response.data);
        Logger.error(err.response.data, MyparcelPlugin.loggerCtx);
        throw errorMessage ? new MyParcelError(errorMessage) : err;
      } else {
        Logger.error(err.response, MyparcelPlugin.loggerCtx);
        throw err;
      }
    }
  }

  getHousenumber(nrAndSuffix: string): [string, string] {
    if (!nrAndSuffix) {
      throw new MyParcelError(`No houseNr given`);
    }
    const [_, houseNr, suffix] = nrAndSuffix.split(/^[^\d]*(\d+)/);
    if (!houseNr) {
      throw new MyParcelError(`Invalid houseNumber ${nrAndSuffix}`);
    }
    return [houseNr, suffix];
  }

  getReadableError(data: MyparcelErrorResponse): string | undefined {
    const error = Object.values(data.errors?.[0] || {}).find(
      (value) => value?.human?.[0]
    );
    return error?.human?.[0];
  }
}

export class MyParcelError extends ApolloError {
  constructor(message: string) {
    super(message, 'MY_PARCEL_ERROR');
  }
}

export interface MyparcelRecipient {
  cc: string;
  region?: string;
  city: string;
  street: string;
  number: string;
  number_suffix?: string;
  postal_code: string;
  person: string;
  phone?: string;
  email?: string;
}

export interface MyparcelShipmentOptions {
  package_type: number;
  label_description?: string;
}

export interface MyparcelShipment {
  carrier: number;
  reference_identifier?: string;
  recipient: MyparcelRecipient;
  options: MyparcelShipmentOptions;
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
        shipment_id: string,
        account_id: number,
        shop_id: number,
        status: number,
        barcode: string
      }
    ]
  }
}

export const myparcelStatusses: {[key: string]: FulfillmentState} = {
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
  11 : 'Delivered',
  32 : 'Shipped',
  33 : 'Shipped',
  34 : 'Shipped',
  35 : 'Shipped',
  36 : 'Delivered',
  37 : 'Delivered',
  38 : 'Delivered',
  99 : 'Delivered'
}


