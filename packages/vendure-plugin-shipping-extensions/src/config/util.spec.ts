import { describe, it, expect } from 'vitest';
import { isEligibleForCountry } from './util';
import { Order } from '@vendure/core';

describe('isEligibleForCountry', () => {
  it('Is eligible if the order country is in the list and excludeCountries is false', () => {
    const order = {
      shippingAddress: {
        countryCode: 'US',
      },
    } as Order;
    const result = isEligibleForCountry(order, ['US', 'CA'], false);
    expect(result).toBe(true);
  });

  it('Is not eligible if the order country is in the list and excludeCountries is true', () => {
    const order = {
      shippingAddress: {
        countryCode: 'US',
      },
    } as Order;
    const result = isEligibleForCountry(order, ['US', 'CA'], true);
    expect(result).toBe(false);
  });

  it('Is not eligible if the order country is not in the list', () => {
    const order = {
      shippingAddress: {
        countryCode: 'MX',
      },
    } as Order;
    const result = isEligibleForCountry(order, ['US', 'CA'], false);
    expect(result).toBe(false);
  });

  it('should return true if the order country is not in the list and excludeCountries is true', () => {
    const order = {
      shippingAddress: {
        countryCode: 'MX',
      },
    } as Order;
    const result = isEligibleForCountry(order, ['US', 'CA'], true);
    expect(result).toBe(true);
  });
});
