import { Injector, Order, RequestContext } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import {
  getHighestTaxRateOfOrder,
  isEligibleForCountry,
} from './shipping-util';

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

describe('getHighestTaxRateOfOrder', () => {
  const mockCtx = {} as RequestContext;
  const mockInjector = {} as Injector;

  it('should return the highest tax rate when surcharge has highest rate, because shipping lines should be ignored', async () => {
    const order = {
      lines: [{ taxRate: 0.1 }],
      surcharges: [{ taxRate: 0.2 }],
      shippingLines: [{ taxRate: 0.3 }],
    } as unknown as Order;
    const result = await getHighestTaxRateOfOrder(mockCtx, mockInjector, order);
    expect(result).toBe(0.2);
  });

  it('should return order line as highest tax rate', async () => {
    // Line has highest rate
    const order = {
      lines: [{ taxRate: 0.2 }],
      surcharges: [{ taxRate: 0.1 }],
      shippingLines: [{ taxRate: 0.3 }],
    } as unknown as Order;
    const result = await getHighestTaxRateOfOrder(mockCtx, mockInjector, order);
    expect(result).toBe(0.2);
  });

  it('should return 0 for order without lines and surcharges', async () => {
    const order = {
      lines: [],
      surcharges: [],
      shippingLines: [{ taxRate: 0.3 }],
    } as unknown as Order;
    const result = await getHighestTaxRateOfOrder(mockCtx, mockInjector, order);
    expect(result).toBe(0);
  });
});
