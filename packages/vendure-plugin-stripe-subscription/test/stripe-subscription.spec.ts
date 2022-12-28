import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import { TestServer } from '@vendure/testing/lib/test-server';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import * as path from 'path';
import * as fs from 'fs';
import { DurationInterval, StartDate } from '../src/schedules';
import {
  getDayRate,
  getDaysUntilNextStartDate,
  stripeSubscriptionHandler,
  SubscriptionBillingInterval,
  StripeSubscriptionPlugin,
} from '../src';
import { CREATE_PAYMENT_METHOD, GET_PRICING } from './helpers';
import { StripeSubscriptionPricing } from 'vendure-plugin-stripe-subscription';

jest.setTimeout(20000);

describe('Order export plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;
  const testEmailDir = path.join(__dirname, './test-emails');
  const emailHandlerConfig = {
    subject: 'Low stock',
    threshold: 100,
  };

  beforeAll(async () => {
    try {
      const files = fs.readdirSync(testEmailDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testEmailDir, file)); // Delete previous test emails
      }
    } catch (err) {}

    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [StripeSubscriptionPlugin],
      paymentOptions: {
        paymentMethodHandlers: [stripeSubscriptionHandler],
      },
    });
    ({ server, adminClient, shopClient } = createTestEnvironment(config));
    await server.init({
      initialData: {
        ...initialData,
        paymentMethods: [
          {
            name: testPaymentMethod.code,
            handler: { code: testPaymentMethod.code, arguments: [] },
          },
        ],
      },
      productsCsvPath: `${__dirname}/subscriptions.csv`,
    });
    serverStarted = true;
  }, 60000);

  it('Should start successfully', async () => {
    expect(serverStarted).toBe(true);
  });

  it('Creates Stripe subscription method', async () => {
    await adminClient.asSuperAdmin();
    await adminClient.query(CREATE_PAYMENT_METHOD, {
      input: {
        code: 'stripe-subscription-method',
        name: 'Stripe test payment',
        description: 'This is a Stripe payment method',
        enabled: true,
        handler: {
          code: 'stripe-subscription',
          arguments: [
            {
              name: 'webhookSecret',
              value: 'testsecret',
            },
            { name: 'apiKey', value: 'test-api-key' },
          ],
        },
      },
    });
  });

  test.each([
    [40000, 1, DurationInterval.Year, 110],
    [80000, 2, DurationInterval.Year, 110],
    [20000, 6, DurationInterval.Month, 110],
    [80000, 24, DurationInterval.Month, 110],
    [20000, 26, DurationInterval.Week, 110],
    [40000, 52, DurationInterval.Week, 110],
    [40000, 365, DurationInterval.Day, 110],
    [110, 1, DurationInterval.Day, 110],
    [39890, 364, DurationInterval.Day, 110],
  ])(
    'Day rate for $%i per %i %s should be $%i',
    (
      price: number,
      count: number,
      interval: DurationInterval,
      expected: number
    ) => {
      expect(getDayRate(price, interval, count)).toBe(expected);
    }
  );

  test.each([
    [
      new Date('2022-12-20'),
      StartDate.START,
      SubscriptionBillingInterval.Month,
      12,
    ],
    [
      new Date('2022-12-20'),
      StartDate.END,
      SubscriptionBillingInterval.Month,
      11,
    ],
    [
      new Date('2022-12-20'),
      StartDate.START,
      SubscriptionBillingInterval.Week,
      5,
    ],
    [
      new Date('2022-12-20'),
      StartDate.END,
      SubscriptionBillingInterval.Week,
      4,
    ],
  ])(
    'Calculate days: from %s to "%s" of %s should be %i $#1',
    (
      now: Date,
      startDate: StartDate,
      interval: SubscriptionBillingInterval,
      expected: number
    ) => {
      expect(getDaysUntilNextStartDate(now, interval, startDate)).toBe(
        expected
      );
    }
  );

  it('Should calculate default pricing', async () => {
    // Uses the default downpayment of $199
    const { stripeSubscriptionPricing } = await shopClient.query(GET_PRICING, {
      input: {
        productVariantId: 2,
      },
    });
    const pricing: StripeSubscriptionPricing = stripeSubscriptionPricing;
    expect(pricing.downpayment).toBe(19900);
    expect(pricing.recurringPrice).toBe(5683);
    expect(pricing.interval).toBe('month');
    expect(pricing.intervalCount).toBe(1);
    expect(pricing.dayRate).toBe(296);
    expect(pricing.amountDueNow).toBe(
      pricing.totalProratedAmount + pricing.downpayment
    );
  });

  it('Should calculate pricing with custom downpayment', async () => {
    const { stripeSubscriptionPricing } = await shopClient.query(GET_PRICING, {
      input: {
        productVariantId: 2,
        downpayment: 0,
      },
    });
    const pricing: StripeSubscriptionPricing = stripeSubscriptionPricing;
    expect(pricing.downpayment).toBe(0);
    expect(pricing.recurringPrice).toBe(9000);
    expect(pricing.interval).toBe('month');
    expect(pricing.intervalCount).toBe(1);
    expect(pricing.dayRate).toBe(296);
    expect(pricing.amountDueNow).toBe(
      pricing.totalProratedAmount + pricing.downpayment
    );
  });

  // TODO
  // Create paymentmethod
  // Create order without customFields
  // Create paymentlink
  // Mock webhook callback
  // Create order with customfields. OrderLine amount should be different
});
