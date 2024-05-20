import { Order, Customer, OrderLine } from '@vendure/core';
import { Shipment, ShipmateAddress, Parcels, Items } from '../types';
import { OrderAddress } from '@vendure/common/lib/generated-types';

export function parseOrder(order: Order, shipmateReference: string): Shipment {
  return {
    shipment_reference: shipmateReference,
    //Make sure this never changes since ShipmateService.updateOrderState depends on it
    order_reference: order.code,
    to_address: parseAddress(order.shippingAddress, order.customer),
    parcels: [parseParcels(order)],
    delivery_instructions: '',
    print_labels: false,
  };
}

export function parseAddress(
  address: OrderAddress,
  customer?: Customer
): ShipmateAddress {
  return {
    name: getRecepientName(
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

export function parseParcels(order: Order): Parcels {
  return {
    reference: Math.random().toString(36).substring(2, 8),
    value: `${order.totalWithTax / 100}`,
    items: order.lines.map((line) => parseOrderLine(line)),
    weight: 30,
    width: 20,
    length: 10,
    depth: 10,
  };
}

export function parseOrderLine(line: OrderLine): Items {
  return {
    item_quantity: line.quantity,
    item_value: line.proratedUnitPriceWithTax,
  };
}

export function getRecepientName(
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
