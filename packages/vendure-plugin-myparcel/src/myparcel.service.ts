// @ts-ignore
import Client from "@myparcel/js-sdk";
import { MyparcelPlugin } from "./myparcel.plugin";
import { Logger, Order } from "@vendure/core";
import { OrderAddress } from "@vendure/admin-ui/core";

export class MyparcelService {

  static getClient(channelToken: string): Client {
    const apiKey = MyparcelPlugin.apiKeys[channelToken];
    if (!apiKey) {
      throw Error(`No MyParcel apiKey found for channel ${channelToken}`);
    }
    let buff = new Buffer(apiKey);
    let encodedKey = buff.toString('base64');
    return new Client(encodedKey);
  }

  static createShipments(channelToken: string, orders: Order[]): Promise<unknown | undefined> {
    return this.getClient(channelToken).shipment.create(this.toShipment(orders)[0]).catch((e: Error) => {
      Logger.error(e.message, MyparcelPlugin.loggerCtx);
      throw e;
    });
  }

  static toShipment(orders: Order[]): MyparcelShipment[] {
    return orders.map(order => {
      Logger.info(`Creating shipment for ${order.code}`, MyparcelPlugin.loggerCtx)
      const address: OrderAddress = order.shippingAddress;
      return {
        carrier: 1, // PostNL
        reference_identifier: order.code,
        options: {
          package_type: 1, // Parcel
          label_description: address.fullName || undefined
        },
        recipient: {
          cc: address.countryCode!,
          region: address.province || undefined,
          city: address.city!,
          street: address.streetLine1!,
          number: address.streetLine2!,
          postal_code: address.postalCode!,
          person: address.fullName!,
          phone: address.phoneNumber!,
          email: order.customer?.emailAddress
        }
      };
    });
  }

}

export interface MyparcelRecipient {
  cc: string;
  region?: string;
  city: string;
  street: string;
  number: string;
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


