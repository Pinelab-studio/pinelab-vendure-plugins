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
import {
  getBillingsPerDuration,
  getDayRate,
  getDaysUntilNextStartDate,
  getNextCyclesStartDate,
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
  UPDATE_VARIANT,
} from './helpers';
// @ts-ignore
import nock from 'nock';
// @ts-ignore
import { getOrder } from '../../test/src/admin-utils';
import { UPSERT_SCHEDULES } from '../src/ui/queries';

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
      initialData,
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

  describe('Get next cycles start date', () => {
    test.each([
      [
        'Start of the month, in 12 months',
        new Date('2022-12-20T12:00:00.000Z'),
        SubscriptionStartMoment.StartOfBillingInterval,
        12,
        SubscriptionInterval.Month,
        '2024-01-01',
      ],
      [
        'End of the month, in 6 months',
        new Date('2022-12-20T12:00:00.000Z'),
        SubscriptionStartMoment.EndOfBillingInterval,
        6,
        SubscriptionInterval.Month,
        '2023-06-30',
      ],
      [
        'Time of purchase, in 8 weeks',
        new Date('2022-12-20'),
        SubscriptionStartMoment.TimeOfPurchase,
        8,
        SubscriptionInterval.Week,
        '2023-02-14',
      ],
    ])(
      'Calculates next cycles start date for "%s"',
      (
        _message: string,
        now: Date,
        startDate: SubscriptionStartMoment,
        intervalCount: number,
        interval: SubscriptionInterval,
        expected: string
      ) => {
        expect(
          getNextCyclesStartDate(now, startDate, interval, intervalCount)
            .toISOString()
            .split('T')[0]
        ).toEqual(expected);
      }
    );
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

  describe('Calculate billings per duration', () => {
    test.each([
      [SubscriptionInterval.Week, 1, SubscriptionInterval.Month, 3, 12],
      [SubscriptionInterval.Week, 2, SubscriptionInterval.Month, 1, 2],
      [SubscriptionInterval.Week, 3, SubscriptionInterval.Month, 3, 4],
      [SubscriptionInterval.Month, 3, SubscriptionInterval.Month, 6, 2],
    ])(
      'for %sly %s',
      (
        billingInterval: SubscriptionInterval,
        billingCount: number,
        durationInterval: SubscriptionInterval,
        durationCount: number,
        expected: number
      ) => {
        expect(
          getBillingsPerDuration({
            billingInterval,
            billingCount,
            durationCount,
            durationInterval,
          })
        ).toBe(expected);
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
      'Calculate days: from %s to "%s" of %s should be %i',
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

  it('Creates a paid-up-front subscription for variant 1', async () => {
    const { upsertStripeSubscriptionSchedule: schedule } =
      await adminClient.query(UPSERT_SCHEDULES, {
        input: {
          name: '6 months, paid in full',
          downpayment: 0,
          durationInterval: SubscriptionInterval.Month,
          durationCount: 6,
          startMoment: SubscriptionStartMoment.StartOfBillingInterval,
          billingInterval: SubscriptionInterval.Month,
          billingCount: 6,
        },
      });
    const {
      updateProductVariants: [variant],
    } = await adminClient.query(UPDATE_VARIANT, {
      input: [
        {
          id: 1,
          customFields: {
            subscriptionScheduleId: schedule.id,
          },
        },
      ],
    });
    expect(schedule.id).toBeDefined();
    expect(schedule.createdAt).toBeDefined();
    expect(schedule.name).toBe('6 months, paid in full');
    expect(schedule.downpayment).toBe(0);
    expect(schedule.paidUpFront).toBe(true);
    expect(schedule.durationInterval).toBe(schedule.billingInterval); // duration and billing should be equal for paid up front subs
    expect(schedule.durationCount).toBe(schedule.billingCount);
    expect(schedule.startMoment).toBe(
      SubscriptionStartMoment.StartOfBillingInterval
    );
    expect(variant.id).toBe(schedule.id);
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
    expect(pricing.amountDueNow).toBe(pricing.totalProratedAmount + 54000);
  });

  it('Creates a 3 month, billed weekly subscription for variant 2', async () => {
    const { upsertStripeSubscriptionSchedule: schedule } =
      await adminClient.query(UPSERT_SCHEDULES, {
        input: {
          name: '6 months, billed monthly, 199 downpayment',
          downpayment: 19900,
          durationInterval: SubscriptionInterval.Month,
          durationCount: 3,
          startMoment: SubscriptionStartMoment.StartOfBillingInterval,
          billingInterval: SubscriptionInterval.Week,
          billingCount: 1,
        },
      });
    const {
      updateProductVariants: [variant],
    } = await adminClient.query(UPDATE_VARIANT, {
      input: [
        {
          id: 2,
          customFields: {
            subscriptionScheduleId: schedule.id,
          },
        },
      ],
    });
    expect(schedule.id).toBeDefined();
    expect(schedule.createdAt).toBeDefined();
    expect(schedule.name).toBe('6 months, billed monthly, 199 downpayment');
    expect(schedule.downpayment).toBe(19900);
    expect(schedule.durationInterval).toBe(SubscriptionInterval.Month);
    expect(schedule.durationCount).toBe(3);
    expect(schedule.billingInterval).toBe(SubscriptionInterval.Week);
    expect(schedule.billingCount).toBe(1);
    expect(schedule.startMoment).toBe(
      SubscriptionStartMoment.StartOfBillingInterval
    );
    expect(variant.id).toBe(schedule.id);
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
    expect(pricing.recurringPrice).toBe(9000);
    expect(pricing.interval).toBe('week');
    expect(pricing.intervalCount).toBe(1);
    expect(pricing.dayRate).toBe(405);
    expect(pricing.amountDueNow).toBe(pricing.totalProratedAmount + 19900);
    expect(pricing.schedule.name).toBe(
      '6 months, billed monthly, 199 downpayment'
    );
  });

  it('Should calculate pricing for recurring with $400 custom downpayment', async () => {
    const { stripeSubscriptionPricing } = await shopClient.query(GET_PRICING, {
      input: {
        productVariantId: 2,
        downpayment: 40000,
      },
    });
    // Default price is $90 a month with a downpayment of $199
    // With a downpayment of $400, the price should be ($400 - $199) / 6 = $33.5 lower, so $56.5
    const pricing: StripeSubscriptionPricing = stripeSubscriptionPricing;
    expect(pricing.downpayment).toBe(40000);
    expect(pricing.recurringPrice).toBe(5650);
    expect(pricing.interval).toBe('month');
    expect(pricing.intervalCount).toBe(1);
    expect(pricing.dayRate).toBe(405);
    expect(pricing.amountDueNow).toBe(pricing.totalProratedAmount + 40000);
  });

  it('Should throw an error when downpayment is below the schedules default', async () => {
    let error = '';
    await shopClient
      .query(GET_PRICING, {
        input: {
          productVariantId: 2,
          downpayment: 0,
        },
      })
      .catch((e) => (error = e.message));
    expect(error).toContain('Downpayment can not be lower than');
  });

  it('Should throw an error when downpayment is higher than the total subscription value', async () => {
    let error = '';
    await shopClient
      .query(GET_PRICING, {
        input: {
          productVariantId: 2,
          downpayment: 90000, // max is 540 + 199 = 739
        },
      })
      .catch((e) => (error = e.message));
    expect(error).toContain('Downpayment can not be higher than');
  });

  it('Should throw error when trying to use a downpayment for paid up front', async () => {
    let error = '';
    await shopClient
      .query(GET_PRICING, {
        input: {
          productVariantId: 1,
          downpayment: 19900, // max is 540 + 199 = 739
        },
      })
      .catch((e) => (error = e.message));
    expect(error).toContain(
      'You can not use downpayments with Paid-up-front subscriptions'
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
    expect(pricing.recurringPrice).toBe(5650);
    expect(pricing.interval).toBe('month');
    expect(pricing.intervalCount).toBe(1);
    expect(pricing.dayRate).toBe(405);
    expect(pricing.amountDueNow).toBe(pricing.totalProratedAmount + 40000);
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
    expect(pricing[1].recurringPrice).toBe(9000);
    expect(pricing[1].interval).toBe('month');
    expect(pricing[1].intervalCount).toBe(1);
    expect(pricing[1].dayRate).toBe(405);
    expect(pricing[1].amountDueNow).toBe(
      pricing[1].totalProratedAmount + pricing[1].downpayment
    );
    expect(pricing.length).toBe(2);
  });

  it('Should create an intent for payment details', async () => {
    // Mock API
    let paymentIntentInput: any = {};
    nock('https://api.stripe.com')
      .get(/customers.*/)
      .reply(200, { data: [{ id: 'customer-test-id' }] });
    nock('https://api.stripe.com')
      .post(/payment_intents.*/, (body) => {
        paymentIntentInput = body;
        return true;
      })
      .reply(200, {
        client_secret: 'mock-secret-1234',
      });
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    await shopClient.query(ADD_ITEM_TO_ORDER, {
      productVariantId: '1',
      quantity: 1,
    });
    await shopClient.query(ADD_ITEM_TO_ORDER, {
      productVariantId: '2',
      quantity: 1,
    });
    const { activeOrder } = await shopClient.query(GET_ORDER_WITH_PRICING);
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

  // TODO
  /*
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
