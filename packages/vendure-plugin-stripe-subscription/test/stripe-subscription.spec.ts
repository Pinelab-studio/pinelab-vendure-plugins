import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import { DefaultLogger, LogLevel, mergeConfig, Order } from '@vendure/core';
import { TestServer } from '@vendure/testing/lib/test-server';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { DurationInterval, StartDate } from '../src/schedules';
import {
  getDayRate,
  getDaysUntilNextStartDate,
  getNextStartDate,
  IncomingStripeWebhook,
  stripeSubscriptionHandler,
  StripeSubscriptionPlugin,
  StripeSubscriptionPricing,
  SubscriptionBillingInterval,
} from '../src';
import {
  ADD_ITEM_TO_ORDER,
  CREATE_PAYMENT_LINK,
  CREATE_PAYMENT_METHOD,
  GET_PRICING,
  setShipping,
} from './helpers';
// @ts-ignore
import nock from 'nock';
import { getOrder } from '../../test/src/admin-utils';

jest.setTimeout(20000);

describe('Order export plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;
  let order: Order | undefined = undefined;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        StripeSubscriptionPlugin.init({
          disableWebhookSignatureChecking: true,
        }),
      ],
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

  describe('Calculate day rate', () => {
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
  });

  describe('Calculate nr of days until next subscription start date', () => {
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
        const nextStartDate = getNextStartDate(now, interval, startDate);
        expect(getDaysUntilNextStartDate(now, nextStartDate)).toBe(expected);
      }
    );
  });

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

  it('Should create a setup intent for payment details', async () => {
    // Mock API
    nock('https://api.stripe.com')
      .get(/customers.*/)
      .reply(200, { data: [{ id: 'customer-test-id' }] });
    nock('https://api.stripe.com')
      .post(/setup_intents.*/)
      .reply(200, {
        client_secret: 'mock-secret-1234',
      });
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    const { addItemToOrder } = await shopClient.query(ADD_ITEM_TO_ORDER, {
      productVariantId: '2',
      quantity: 1,
      customFields: {
        downpayment: 0,
      },
    });
    order = addItemToOrder;
    await setShipping(shopClient);
    const { createStripeSubscriptionIntent: secret } = await shopClient.query(
      CREATE_PAYMENT_LINK
    );
    expect(secret).toBe('mock-secret-1234');
  });

  it('Should create subscriptions on webhook succeed', async () => {
    // Mock API
    nock('https://api.stripe.com')
      .get(/customers.*/)
      .reply(200, { data: [{ id: 'customer-test-id' }] });
    nock('https://api.stripe.com')
      .post(/setup_intents.*/)
      .reply(200, {
        client_secret: 'mock-secret-1234',
      });
    let adminOrder = await getOrder(adminClient as any, order!.id as string);
    await adminClient.fetch(
      'http://localhost:3050/stripe-subscriptions/webhook',
      {
        method: 'POST',
        body: JSON.stringify({
          type: 'setup_intent.succeeded',
          data: {
            object: {
              customer: 'mock',
              metadata: {
                orderCode: order!.code,
                paymentMethodCode: 'stripe-subscription-method',
                channelToken: 'e2e-default-channel',
                amount: adminOrder?.totalWithTax,
              },
            },
          },
        } as IncomingStripeWebhook),
      }
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    adminOrder = await getOrder(adminClient as any, order!.id as string);
    expect(adminOrder?.state).toBe('PaymentSettled');

    // TODO check outgoing subscription requests
  });
});
