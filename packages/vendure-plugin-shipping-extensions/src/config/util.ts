import { Order } from '@vendure/core';

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
