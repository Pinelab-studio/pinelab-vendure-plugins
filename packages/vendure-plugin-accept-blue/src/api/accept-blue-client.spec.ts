import { it, expect } from 'vitest';
import { AcceptBlueClient } from './accept-blue-client';
import { AcceptBluePaymentMethodType } from './generated/graphql';

const API_KEY = 'test-api-key';
const PIN = 'test-pin';
it('should enable all payment methods when all are allowed', () => {
  const client = new AcceptBlueClient(API_KEY, PIN, {
    allowECheck: true,
    allowVisa: true,
    allowMasterCard: true,
    allowAmericanExpress: true,
    allowDiscover: true,
  });

  const expected: AcceptBluePaymentMethodType[] = [
    'ECheck',
    'Visa',
    'MasterCard',
    'Amex',
    'Discover',
  ];
  expect(client.enabledPaymentMethods).toEqual(
    expect.arrayContaining(expected)
  );
  expect(client.enabledPaymentMethods.length).toBe(5);
});

it('should only enable specified payment methods', () => {
  const client = new AcceptBlueClient(API_KEY, PIN, {
    allowECheck: true,
    allowVisa: true,
    allowMasterCard: false,
    allowAmericanExpress: false,
    allowDiscover: false,
  });

  expect(client.enabledPaymentMethods).toEqual(['ECheck', 'Visa']);
  expect(client.enabledPaymentMethods.length).toBe(2);
});

it('should enable no payment methods when none are allowed', () => {
  const client = new AcceptBlueClient(API_KEY, PIN, {
    allowECheck: false,
    allowVisa: false,
    allowMasterCard: false,
    allowAmericanExpress: false,
    allowDiscover: false,
  });

  expect(client.enabledPaymentMethods).toEqual([]);
});

it('should use test endpoint when testMode is true', () => {
  const client = new AcceptBlueClient(
    API_KEY,
    PIN,
    {
      allowECheck: true,
    },
    true
  );

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
