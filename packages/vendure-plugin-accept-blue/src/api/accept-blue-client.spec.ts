import { it, expect } from 'vitest';
import { AcceptBlueClient } from './accept-blue-client';
import { AcceptBluePaymentMethodType } from './generated/graphql';
import { AllowedPaymentMethodInput } from '../types';

const API_KEY = 'test-api-key';
const PIN = 'test-pin';
it('should enable all payment methods when all are allowed', () => {
  const client = new AcceptBlueClient(API_KEY, PIN, {
    allowECheck: true,
    allowVisa: true,
    allowMasterCard: true,
    allowAmex: true,
    allowDiscover: true,
    allowGooglePay: true,
    allowApplePay: true,
  });

  const expected: AcceptBluePaymentMethodType[] = [
    'ECheck',
    'Visa',
    'MasterCard',
    'Amex',
    'Discover',
    'GooglePay',
    'ApplePay',
  ];
  expect(client.enabledPaymentMethods).toEqual(
    expect.arrayContaining(expected)
  );
});

it('should only enable specified payment methods', () => {
  const client = new AcceptBlueClient(API_KEY, PIN, {
    allowECheck: true,
    allowVisa: true,
    allowMasterCard: false,
    allowAmex: false,
    allowDiscover: false,
    allowGooglePay: false,
    allowApplePay: false,
  });
  expect(client.enabledPaymentMethods).toEqual(['ECheck', 'Visa']);
  expect(client.enabledPaymentMethods.length).toBe(2);
});

it('should enable no payment methods when none are allowed', () => {
  const client = new AcceptBlueClient(API_KEY, PIN, {
    allowECheck: false,
    allowVisa: false,
    allowMasterCard: false,
    allowAmex: false,
    allowDiscover: false,
    allowGooglePay: false,
    allowApplePay: false,
  });
  expect(client.enabledPaymentMethods).toEqual([]);
});

// Check allowance of methods
it.each([
  {
    name: 'allows ECheck when enabled',
    paymentMethod: { payment_method_type: 'check' },
  },
  {
    name: 'allows Visa when enabled',
    paymentMethod: { card_type: 'Visa' },
  },
  {
    name: 'allows Visa when enabled',
    paymentMethod: { card_type: 'Amex' },
  },
  {
    name: 'allows GooglePay when enabled',
    paymentMethod: { source: 'googlepay' },
  },
  {
    name: 'allows ApplePay when enabled',
    paymentMethod: { source: 'applepay' },
  },
])('$name', ({ paymentMethod }) => {
  const client = new AcceptBlueClient(API_KEY, PIN, {
    allowECheck: true,
    allowVisa: true,
    allowMasterCard: true,
    allowAmex: true,
    allowDiscover: true,
    allowGooglePay: true,
    allowApplePay: true,
  });
  expect(() =>
    client.throwIfPaymentMethodNotAllowed(
      paymentMethod as AllowedPaymentMethodInput
    )
  ).not.toThrow();
});

// Check blocking of all methods
it.each([
  {
    name: 'Throws error for ECheck when disabled',
    paymentMethod: { payment_method_type: 'check' },
  },
  {
    name: 'Throws error for Visa when disabled',
    paymentMethod: { card_type: 'Visa' },
  },
  {
    name: 'Throws error for Amex when disabled',
    paymentMethod: { card_type: 'Amex' },
  },
  {
    name: 'Throws error for GooglePay when disabled',
    paymentMethod: { source: 'googlepay' },
  },
  {
    name: 'Throws error for ApplePay when disabled',
    paymentMethod: { source: 'applepay' },
  },
])('$name', ({ paymentMethod }) => {
  const client = new AcceptBlueClient(API_KEY, PIN, {
    allowECheck: false,
    allowVisa: false,
    allowMasterCard: false,
    allowAmex: false,
    allowDiscover: false,
    allowGooglePay: false,
    allowApplePay: false,
  });
  expect(() =>
    client.throwIfPaymentMethodNotAllowed(
      paymentMethod as AllowedPaymentMethodInput
    )
  ).toThrow();
});

it('should use test endpoint when testMode is true', () => {
  const client = new AcceptBlueClient(API_KEY, PIN, {}, true);
  expect(client.endpoint).toBe('https://api.develop.accept.blue/api/v2/');
});

it('should use production endpoint when testMode is false', () => {
  const client = new AcceptBlueClient(
    API_KEY,
    PIN,
    {
      allowECheck: true,
    },
    false
  );
  expect(client.endpoint).toBe('https://api.accept.blue/api/v2/');
});
