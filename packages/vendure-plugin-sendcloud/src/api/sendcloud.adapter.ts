import { Order, OrderLine } from '@vendure/core';
import {
  ParcelInput,
  ParcelInputItem,
} from './types/sendcloud-api-input.types';

/**
 * Transforms order and variants to ParcelInput
 * @param order including lines, shippingaddress and customer
 */
export function toParcelInput(order: Order): ParcelInput {
  const items = order.lines
    .filter((line) => line.quantity >= 1)
    .map(toParcelInputItem);
  return {
    name: order.shippingAddress.fullName || '-',
    company_name: order.shippingAddress.company,
    address: order.shippingAddress.streetLine1!,
    house_number: order.shippingAddress.streetLine2!,
    city: order.shippingAddress.city!,
    postal_code: order.shippingAddress.postalCode!,
    country: order.shippingAddress.countryCode!,
    telephone: order.customer?.phoneNumber,
    request_label: false,
    email: order.customer?.emailAddress,
    order_number: order.code,
    parcel_items: items,
    weight: getTotalWeight(items),
  };
}

/**
 * @param variant including corresponding product
 * @param line
 */
export function toParcelInputItem(line: OrderLine): ParcelInputItem {
  const variant = line.productVariant;
  let weightPerUnit = (variant.product?.customFields as any)?.weight || 0;
  let hsCode = (variant.product?.customFields as any)?.hsCode;
  if (weightPerUnit < 0.001) {
    weightPerUnit = 0.001;
  }
  const parcelInput: ParcelInputItem = {
    description: variant.name,
    quantity: line.quantity,
    weight: weightPerUnit.toFixed(3),
    sku: variant.sku,
    value: (variant.priceWithTax / 100).toFixed(2),
  };
  if (hsCode && hsCode.length > 1) {
    parcelInput.hs_code = hsCode;
    parcelInput.origin_country = 'NL';
  }
  return parcelInput;
}

export function getTotalWeight(items: ParcelInputItem[]): string {
  let totalWeight = 0;
  items.forEach((item) => {
    totalWeight += parseFloat(item.weight) * item.quantity;
  });
  return totalWeight.toFixed(3);
}

/**
 * Add customerNote as parcelitem
 */
export function addNote(parceInput: ParcelInput, note: string): ParcelInput {
  parceInput.parcel_items.unshift({
    description: note,
    quantity: 1,
    weight: '0.1',
    sku: 'Klant notitie',
    value: '0',
  });
  return parceInput;
}

/**
 * Add nr of orders for this customer as parcelItem
 */
export function addNrOfOrders(
  parceInput: ParcelInput,
  nrOfOrders: number
): ParcelInput {
  const nrOfOrderString =
    typeof nrOfOrders === undefined ? 'Niet beschikbaar' : String(nrOfOrders);
  parceInput.parcel_items.unshift({
    description: nrOfOrderString,
    quantity: 1,
    weight: '0.1',
    sku: `Aantal punten`,
    value: '0',
  });
  return parceInput;
}

/**
 * Add couponcodes to sendCloud payload
 */
export function addCouponCodes(
  parceInput: ParcelInput,
  couponCodes: string[] = []
): ParcelInput | undefined {
  const couponCodesString = couponCodes.join(',');
  if (!couponCodes || couponCodes.length === 0 || !couponCodesString.trim()) {
    return;
  }
  parceInput.parcel_items.unshift({
    description: couponCodesString,
    quantity: 1,
    weight: '0.1',
    sku: `Couponcodes`,
    value: '0',
  });
  return parceInput;
}
