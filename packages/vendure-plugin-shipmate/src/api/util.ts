import type { Order, Customer, OrderLine } from '@vendure/core';
import type { Shipment, ShipmateAddress, Parcels, Items } from '../types';
import type { OrderAddress } from '@vendure/common/lib/generated-types';

export function parseOrder(order: Order, shipmateReference?: string): Shipment {
  return {
    shipment_reference: shipmateReference || order.code,
    // Make sure this never changes since ShipmateService.updateOrderState depends on it
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
    company_name: address.company?.substring(0, 40) ?? '',
    telephone: customer?.phoneNumber?.substring(0, 40) ?? '',
    email_address: customer?.emailAddress?.substring(0, 40) ?? '',
    line_1: address?.streetLine1?.substring(0, 40) ?? '',
    line_2: address?.streetLine2?.substring(0, 40) ?? '',
    line_3: '',
    city: address?.city?.substring(0, 40) ?? '',
    county: address.province?.substring(0, 40) ?? '',
    postcode: address.postalCode?.substring(0, 40) ?? '',
    country: address.countryCode?.substring(0, 40) ?? '',
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
    full_description: line.productVariant?.product?.description?.substring(
      0,
      40
    ),
    short_description: line.productVariant?.name?.substring(0, 40),
  };
}

export function getRecepientName(
  fullName?: string,
  customerFirstName?: string,
  customerLastName?: string
) {
  if (fullName) {
    return fullName.substring(0, 40);
  }
  if (customerFirstName && customerLastName) {
    return `${customerFirstName} ${customerLastName}`.substring(0, 40);
  }
  return '';
}
