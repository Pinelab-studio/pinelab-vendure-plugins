import { Order, OrderLine } from '@vendure/core';
import { ParcelInput, ParcelInputItem } from './types/sendcloud-api.types';
import { SendcloudPluginOptions } from './types/sendcloud.types';

/**
 * Transforms order and variants to ParcelInput
 * @param order including lines, shippingaddress and customer
 * @param options
 */
export function toParcelInput(
  order: Order,
  options: SendcloudPluginOptions
): ParcelInput {
  const items = order.lines
    .filter((line) => line.quantity >= 1)
    .map((line) => toParcelInputItem(line, options));
  return {
    name: order.shippingAddress.fullName || '-',
    company_name: order.shippingAddress.company,
    address: order.shippingAddress.streetLine1!,
    house_number: order.shippingAddress.streetLine2!,
    city: order.shippingAddress.city!,
    postal_code: order.shippingAddress.postalCode!,
    country: order.shippingAddress.countryCode!.toUpperCase(),
    telephone: order.customer?.phoneNumber,
    request_label: false,
    email: order.customer?.emailAddress,
    order_number: order.code,
    parcel_items: items,
    weight: getTotalWeight(items),
    shipping_method_checkout_name:
      order.shippingLines?.[0].shippingMethod?.code,
  };
}

export function toParcelInputItem(
  line: OrderLine,
  options: SendcloudPluginOptions
): ParcelInputItem {
  const variant = line.productVariant;
  let weightPerUnit = options.weightFn?.(line) || 0;
  let hsCode = options.hsCodeFn?.(line);
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
  const originCountry = options.originCountryFn?.(line);
  if (originCountry) {
    parcelInput.origin_country = originCountry;
  }
  if (hsCode && hsCode.length > 1) {
    parcelInput.hs_code = hsCode;
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
