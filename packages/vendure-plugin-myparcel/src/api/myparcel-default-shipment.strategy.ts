import { Order } from '@vendure/core';
import { OrderAddress } from '@vendure/common/lib/generated-types';
import {
  MyParcelError,
  MyParcelShipmentStrategy,
  MyparcelRecipient,
  MyparcelShipment,
  MyparcelShipmentOptions,
} from './types';

export class MyParcalDefaultShipmentStrategy
  implements MyParcelShipmentStrategy
{
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

  getOptions(address: OrderAddress, order: Order, customsContent: string) {
    return {
      package_type: 1, // Parcel
      label_description: order.code,
    };
  }

  getRecipient(address: OrderAddress, order: Order, customsContent: string) {
    const [nr, nrSuffix] = this.getHousenumber(address.streetLine2!);

    return {
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
    };
  }

  getShipment(address: OrderAddress, order: Order, customsContent: string) {
    const shipment: MyparcelShipment = {
      carrier: 1, // PostNL
      reference_identifier: order.code,
      options: this.getOptions(address, order, customsContent),
      recipient: this.getRecipient(address, order, customsContent),
    };

    return shipment;
  }
}
