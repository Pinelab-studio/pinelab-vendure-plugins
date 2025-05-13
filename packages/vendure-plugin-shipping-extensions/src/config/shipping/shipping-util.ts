import {
  assertFound,
  Injector,
  Order,
  OrderService,
  RequestContext,
} from '@vendure/core';

/**
 * Checks if an order is eligible for the given country codes.
 * When excludedCountries=true: The order is eligible if it's country is NOT in the configured countryCodes
 */
export function isEligibleForCountry(
  order: Order,
  countryCodes: string[],
  excludeCountries: boolean
): boolean {
  const shippingCountry = order.shippingAddress.countryCode;
  const orderIsInSelectedCountry = shippingCountry
    ? countryCodes.includes(shippingCountry)
    : false;
  if (orderIsInSelectedCountry && excludeCountries) {
    // Not eligible, because order.country is in our excluded-country-list
    return false;
  }
  if (!orderIsInSelectedCountry && !excludeCountries) {
    // Not eligible, because order.country is not in our list, but it should be
    return false;
  }
  return true;
}

/**
 * Find the highest tax rate of an order, based on the lines and surcharges.
 * Hydrates the surcharges and lines if they are not already loaded.
 */
export async function getHighestTaxRateOfOrder(
  ctx: RequestContext,
  injector: Injector,
  order: Order
): Promise<number> {
  let orderWithRelations = order;
  if (!order.surcharges || !order.lines) {
    orderWithRelations = await assertFound(
      injector.get(OrderService).findOne(ctx, order.id, ['lines', 'surcharges'])
    );
  }
  const lineTaxRates = orderWithRelations.lines.map((line) => line.taxRate);
  const surchargeTaxRates = orderWithRelations.surcharges.map(
    (surcharge) => surcharge.taxRate
  );
  return Math.max(...lineTaxRates, ...surchargeTaxRates, 0);
}
