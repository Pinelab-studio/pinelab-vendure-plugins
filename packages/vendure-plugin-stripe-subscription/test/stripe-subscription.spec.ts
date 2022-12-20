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
import { stripeSubscriptionHandler } from '../src/stripe-subscription.handler';
import { getDayRate, getDaysUntilNextStartDate } from '../src/util';
import {
  BillingInterval,
  DurationInterval,
  StartDate,
} from '../src/subscription-custom-fields';

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
      plugins: [],
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
      productsCsvPath: '../test/src/products-import.csv',
    });
    serverStarted = true;
  }, 60000);

  it('Should start successfully', async () => {
    expect(serverStarted).toBe(true);
  });

  test.each([
    [40000, 1, DurationInterval.YEAR, 110],
    [80000, 2, DurationInterval.YEAR, 110],
    [20000, 6, DurationInterval.MONTH, 110],
    [80000, 24, DurationInterval.MONTH, 110],
    [20000, 26, DurationInterval.WEEK, 110],
    [40000, 52, DurationInterval.WEEK, 110],
    [40000, 365, DurationInterval.DAY, 110],
    [110, 1, DurationInterval.DAY, 110],
    [39890, 364, DurationInterval.DAY, 110],
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
    [new Date('2022-12-20'), StartDate.START, BillingInterval.MONTH, 12],
    [new Date('2022-12-20'), StartDate.END, BillingInterval.MONTH, 11],
    [new Date('2022-12-20'), StartDate.START, BillingInterval.WEEK, 5],
    [new Date('2022-12-20'), StartDate.END, BillingInterval.WEEK, 4],
  ])(
    'Calculate days: from %s to "%s" of %s should be %i $#1',
    (
      now: Date,
      startDate: StartDate,
      interval: BillingInterval,
      expected: number
    ) => {
      expect(getDaysUntilNextStartDate(now, interval, startDate)).toBe(
        expected
      );
    }
  );

  // TODO
  // Create paymentmethod
  // Prepare order
  // Create paymentlink with one time payment
  // Create paymentlink with monthly payments, downpayment and prorated amount
});
