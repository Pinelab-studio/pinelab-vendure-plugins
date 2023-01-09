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
import {
  getDayRate,
  getDaysUntilNextStartDate,
  getNextStartDate,
  IncomingStripeWebhook,
  OrderLineWithSubscriptionFields,
  stripeSubscriptionHandler,
  StripeSubscriptionPlugin,
  StripeSubscriptionPricing,
  SubscriptionInterval,
  SubscriptionStartMoment,
} from '../src';
import {
  ADD_ITEM_TO_ORDER,
  CREATE_PAYMENT_LINK,
  CREATE_PAYMENT_METHOD,
  GET_ORDER_WITH_PRICING,
  GET_PRICING,
  GET_PRICING_FOR_PRODUCT,
  GET_SCHEDULES,
  setShipping,
} from './helpers';
// @ts-ignore
import nock from 'nock';
// @ts-ignore
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

  it('TODO getNextCycle', async () => {
    // TODO getNextCycle() test
    expect(true).toBe(true);
  });

  describe('Calculate day rate', () => {
    test.each([
      [20000, 6, SubscriptionInterval.Month, 110],
      [80000, 24, SubscriptionInterval.Month, 110],
      [20000, 26, SubscriptionInterval.Week, 110],
      [40000, 52, SubscriptionInterval.Week, 110],
    ])(
      'Day rate for $%i per %i %s should be $%i',
      (
        price: number,
        count: number,
        interval: SubscriptionInterval,
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
        SubscriptionStartMoment.StartOfBillingInterval,
        SubscriptionInterval.Month,
        12,
      ],
      [
        new Date('2022-12-20'),
        SubscriptionStartMoment.EndOfBillingInterval,
        SubscriptionInterval.Month,
        11,
      ],
      [
        new Date('2022-12-20'),
        SubscriptionStartMoment.StartOfBillingInterval,
        SubscriptionInterval.Week,
        5,
      ],
      [
        new Date('2022-12-20'),
        SubscriptionStartMoment.EndOfBillingInterval,
        SubscriptionInterval.Week,
        4,
      ],
    ])(
      'Calculate days: from %s to "%s" of %s should be %i $#1',
      (
        now: Date,
        startDate: SubscriptionStartMoment,
        interval: SubscriptionInterval,
        expected: number
      ) => {
        const nextStartDate = getNextStartDate(now, interval, startDate);
        expect(getDaysUntilNextStartDate(now, nextStartDate)).toBe(expected);
      }
    );
  });

  it('Should calculate default pricing for paid up front', async () => {
    const { stripeSubscriptionPricing } = await shopClient.query(GET_PRICING, {
      input: {
        productVariantId: 1,
      },
    });
    const pricing: StripeSubscriptionPricing = stripeSubscriptionPricing;
    expect(pricing.downpayment).toBe(0);
    expect(pricing.recurringPrice).toBe(54000);
    expect(pricing.interval).toBe('month');
    expect(pricing.intervalCount).toBe(6);
    expect(pricing.dayRate).toBe(296);
    expect(pricing.amountDueNow).toBe(
      pricing.totalProratedAmount + pricing.downpayment + pricing.recurringPrice
    );
  });

  it('Should calculate default pricing for recurring', async () => {
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

  it('Should calculate pricing for recurring with 400 custom downpayment', async () => {
    // Uses the default downpayment of $199
    const { stripeSubscriptionPricing } = await shopClient.query(GET_PRICING, {
      input: {
        productVariantId: 2,
        downpayment: 40000,
      },
    });
    const pricing: StripeSubscriptionPricing = stripeSubscriptionPricing;
    expect(pricing.downpayment).toBe(40000);
    expect(pricing.recurringPrice).toBe(2333);
    expect(pricing.interval).toBe('month');
    expect(pricing.intervalCount).toBe(1);
    expect(pricing.dayRate).toBe(296);
    expect(pricing.amountDueNow).toBe(
      pricing.totalProratedAmount + pricing.downpayment
    );
  });

  it('Should calculate pricing with 0 custom downpayment', async () => {
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

  it('Should calculate pricing for recurring with custom downpayment and custom startDate', async () => {
    // Uses the default downpayment of $199
    const in3Days = new Date();
    in3Days.setDate(in3Days.getDate() + 3);
    const { stripeSubscriptionPricing } = await shopClient.query(GET_PRICING, {
      input: {
        productVariantId: 2,
        downpayment: 40000,
        startDate: in3Days.toISOString(),
      },
    });
    const pricing: StripeSubscriptionPricing = stripeSubscriptionPricing;
    expect(pricing.downpayment).toBe(40000);
    expect(pricing.recurringPrice).toBe(2333);
    expect(pricing.interval).toBe('month');
    expect(pricing.intervalCount).toBe(1);
    expect(pricing.dayRate).toBe(296);
    expect(pricing.amountDueNow).toBe(
      pricing.totalProratedAmount + pricing.downpayment
    );
  });

  it('Should calculate pricing for product', async () => {
    const { stripeSubscriptionPricingForProduct } = await shopClient.query(
      GET_PRICING_FOR_PRODUCT,
      {
        productId: 1,
      }
    );
    const pricing: StripeSubscriptionPricing[] =
      stripeSubscriptionPricingForProduct;
    expect(pricing[1].downpayment).toBe(19900);
    expect(pricing[1].recurringPrice).toBe(5683);
    expect(pricing[1].interval).toBe('month');
    expect(pricing[1].intervalCount).toBe(1);
    expect(pricing[1].dayRate).toBe(296);
    expect(pricing[1].amountDueNow).toBe(
      pricing[1].totalProratedAmount + pricing[1].downpayment
    );
    expect(pricing.length).toBe(2);
  });

  it('Should create an intent for payment details', async () => {
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

  it('Should have pricing and schedule on order line', async () => {
    const { activeOrder } = await shopClient.query(GET_ORDER_WITH_PRICING);
    const line: OrderLineWithSubscriptionFields = activeOrder.lines[0];
    expect(line.subscriptionPricing).toBeDefined();
    expect(line.subscriptionPricing?.schedule).toBeDefined();
    expect(line.subscriptionPricing?.schedule.name).toBeDefined();
    expect(line.subscriptionPricing?.schedule.downpayment).toBe(19900);
    expect(line.subscriptionPricing?.schedule.durationInterval).toBe('month');
    expect(line.subscriptionPricing?.schedule.durationCount).toBe(6);
    expect(line.subscriptionPricing?.schedule.paidUpFront).toBe(false);
  });

  it('Should create subscriptions on webhook succeed', async () => {
    // Mock API
    let subscriptionBody: any;
    let downpaymentBody: any;
    nock('https://api.stripe.com')
      .get(/customers.*/)
      .reply(200, { data: [{ id: 'customer-test-id' }] });
    nock('https://api.stripe.com')
      .post(/products.*/)
      .reply(200, {
        id: 'test-product',
      });
    nock('https://api.stripe.com')
      .post(/subscriptions.*/, (body) => {
        subscriptionBody = body;
        return true;
      })
      .reply(200, {
        id: 'mock-recurring-sub',
        status: 'active',
      });
    nock('https://api.stripe.com')
      .post(/subscriptions.*/, (body) => {
        downpaymentBody = body;
        return true;
      })
      .reply(200, {
        id: 'mock-downpayment-sub',
        status: 'active',
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
    // Recurring subscription
    expect(subscriptionBody?.customer).toBe('mock');
    expect(subscriptionBody?.billing_cycle_anchor).toBeDefined();
    expect(subscriptionBody?.proration_behavior).toBe('create_prorations');
    expect(subscriptionBody?.['items[0][price_data][unit_amount]']).toBe(
      '5683'
    );
    expect(
      subscriptionBody?.['items[0][price_data][recurring][interval]']
    ).toBe('month');
    expect(
      subscriptionBody?.['items[0][price_data][recurring][interval_count]']
    ).toBe('1');
    // Downpayment subscription
    expect(downpaymentBody?.customer).toBe('mock');
    expect(downpaymentBody?.billing_cycle_anchor).toBeDefined();
    expect(downpaymentBody?.proration_behavior).toBe('none');
    expect(downpaymentBody?.['items[0][price_data][unit_amount]']).toBe(
      '19900'
    );
    expect(downpaymentBody?.['items[0][price_data][recurring][interval]']).toBe(
      'month'
    );
    expect(
      downpaymentBody?.['items[0][price_data][recurring][interval_count]']
    ).toBe('6');
  });

  it('Can retrieve Schedules', async () => {
    await adminClient.asSuperAdmin();
    const { stripeSubscriptionSchedules: schedules } = await adminClient.query(
      GET_SCHEDULES
    );
    expect(schedules[0]).toBeDefined();
    expect(schedules[0].id).toBeDefined();
  });

  /*

        it('Can retrieve Schedules', async () => {
          expect(true).toBe(false);
        });

       it('Can create Schedules', async () => {
          expect(true).toBe(false);
        });

        it('Can update Schedules', async () => {
          expect(true).toBe(false);
        });


        it('Can delete Schedules', async () => {
          expect(true).toBe(false);
        });*/
});
