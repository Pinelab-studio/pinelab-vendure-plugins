import { MyparcelPlugin } from "./myparcel.plugin";
import { Logger, Order } from "@vendure/core";
import { OrderAddress } from "@vendure/admin-ui/core";
import { ApolloError } from "apollo-server-core";
import axios from "axios";

export class MyparcelService {

  static client = axios.create({
    baseURL: "https://api.myparcel.nl/",
    headers: {
      "Content-Type": "application/vnd.shipment+json;version=1.1;charset=utf-8"
    }
  });

  static async createShipments(
    channelToken: string,
    orders: Order[]
  ): Promise<unknown | undefined> {
    const shipments = this.toShipment(orders);
    return this.post("shipments", { shipments }, channelToken);
  }

  static toShipment(orders: Order[]): MyparcelShipment[] {
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
          label_description: order.code
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
          email: order.customer?.emailAddress
        }
      };
    });
  }

  static async post(path: string, body: unknown, channelToken: string): Promise<unknown> {
    const apiKey = MyparcelPlugin.apiKeys[channelToken];
    if (!apiKey) {
      throw new MyParcelError(`No apiKey found for channel ${channelToken}`);
    }
    let buff = new Buffer(apiKey);
    let encodedKey = buff.toString("base64");
    this.client.defaults.headers["Authorization"] = `basic ${encodedKey}`;

    console.log(JSON.stringify({ data: body }));
    console.log(this.client.defaults.headers);
    try {
      const res = await this.client.post(path, {
        data: body
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

  static getHousenumber(nrAndSuffix: string): [string, string] {
    if (!nrAndSuffix) {
      throw new MyParcelError(`No houseNr given`);
    }
    const [_, houseNr, suffix] = nrAndSuffix.split(/^[^\d]*(\d+)/);
    if (!houseNr) {
      throw new MyParcelError(`Invalid houseNumber ${nrAndSuffix}`);
    }
    return [houseNr, suffix];
  }

  static getReadableError(data: MyparcelErrorResponse): string | undefined {
    const error = Object.values(data.errors?.[0] || {}).find(value => value?.human?.[0])
    return error?.human?.[0];
  }
}

export class MyParcelError extends ApolloError {
  constructor(message: string) {
    super(message, "MY_PARCEL_ERROR");
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