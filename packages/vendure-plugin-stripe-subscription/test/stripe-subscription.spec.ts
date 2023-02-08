import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import {
  ChannelService,
  DefaultLogger,
  EventBus,
  LogLevel,
  mergeConfig,
  Order,
  OrderPlacedEvent,
  OrderStateTransitionEvent,
} from '@vendure/core';
import { TestServer } from '@vendure/testing/lib/test-server';
import {
  calculateSubscriptionPricing,
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
  VariantForCalculation,
  Schedule,
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
  UPDATE_CHANNEL,
  UPDATE_VARIANT,
} from './helpers';
// @ts-ignore
import nock from 'nock';
// @ts-ignore
import { getOrder } from '../../test/src/admin-utils';
import { DELETE_SCHEDULE, UPSERT_SCHEDULES } from '../src/ui/queries';

jest.setTimeout(20000);

describe('Order export plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;
  let order: Order | undefined;
  let orderEvents: (OrderStateTransitionEvent | OrderPlacedEvent)[] = [];

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

  it('Listens for OrderPlacedEvent and OrderStateTransitionEvents', async () => {
    server.app
      .get(EventBus)
      .ofType(OrderPlacedEvent)
      .subscribe((event) => {
        orderEvents.push(event);
      });
    server.app
      .get(EventBus)
      .ofType(OrderStateTransitionEvent)
      .subscribe((event) => {
        orderEvents.push(event);
      });
  });

  it("Sets channel settings to 'prices are including tax'", async () => {
    await adminClient.asSuperAdmin();
    const {
      updateChannel: { id },
    } = await adminClient.query(UPDATE_CHANNEL, {
      input: {
        id: 'T_1',
        pricesIncludeTax: true,
      },
    });
    expect(id).toBe('T_1');
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
        undefined,
        12,
      ],
      [
        new Date('2022-12-20'),
        SubscriptionStartMoment.EndOfBillingInterval,
        SubscriptionInterval.Month,
        undefined,
        11,
      ],
      [
        new Date('2022-12-20'),
        SubscriptionStartMoment.StartOfBillingInterval,
        SubscriptionInterval.Week,
        undefined,
        5,
      ],
      [
        new Date('2022-12-20'),
        SubscriptionStartMoment.EndOfBillingInterval,
        SubscriptionInterval.Week,
        undefined,
        4,
      ],
      [
        new Date('2022-12-20'),
        SubscriptionStartMoment.TimeOfPurchase,
        SubscriptionInterval.Week,
        undefined,
        0,
      ],
      [
        new Date('2022-12-20'),
        SubscriptionStartMoment.FixedStartdate,
        SubscriptionInterval.Week,
        new Date('2022-12-22'),
        2,
      ],
    ])(
      'Calculate days: from %s to "%s" of %s should be %i',
      (
        now: Date,
        startDate: SubscriptionStartMoment,
        interval: SubscriptionInterval,
        fixedStartDate: Date | undefined,
        expected: number
      ) => {
        const nextStartDate = getNextStartDate(
          now,
          interval,
          startDate,
          fixedStartDate
        );
        expect(getDaysUntilNextStartDate(now, nextStartDate)).toBe(expected);
      }
    );
  });

  it('Creates a paid-up-front subscription for variant 1 ($540)', async () => {
    const { upsertStripeSubscriptionSchedule: schedule } =
      await adminClient.query(UPSERT_SCHEDULES, {
        input: {
          name: '6 months, paid in full',
          downpaymentWithTax: 0,
          durationInterval: SubscriptionInterval.Month,
          durationCount: 6,
          startMoment: SubscriptionStartMoment.StartOfBillingInterval,
          billingInterval: SubscriptionInterval.Month,
          billingCount: 6,
          autoRenew: true,
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
    expect(schedule.downpaymentWithTax).toBe(0);
    expect(schedule.paidUpFront).toBe(true);
    expect(schedule.durationInterval).toBe(schedule.billingInterval); // duration and billing should be equal for paid up front subs
    expect(schedule.durationCount).toBe(schedule.billingCount);
    expect(schedule.startMoment).toBe(
      SubscriptionStartMoment.StartOfBillingInterval
    );
    expect(variant.id).toBe(schedule.id);
  });

  it('Creates a 3 month, billed weekly subscription for variant 2 ($90)', async () => {
    const { upsertStripeSubscriptionSchedule: schedule } =
      await adminClient.query(UPSERT_SCHEDULES, {
        input: {
          name: '6 months, billed monthly, 199 downpayment',
          downpaymentWithTax: 19900,
          durationInterval: SubscriptionInterval.Month,
          durationCount: 3,
          startMoment: SubscriptionStartMoment.StartOfBillingInterval,
          billingInterval: SubscriptionInterval.Week,
          billingCount: 1,
          autoRenew: false,
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
    expect(schedule.downpaymentWithTax).toBe(19900);
    expect(schedule.durationInterval).toBe(SubscriptionInterval.Month);
    expect(schedule.durationCount).toBe(3);
    expect(schedule.billingInterval).toBe(SubscriptionInterval.Week);
    expect(schedule.billingCount).toBe(1);
    expect(schedule.startMoment).toBe(
      SubscriptionStartMoment.StartOfBillingInterval
    );
    expect(variant.id).toBe(schedule.id);
  });

  describe('Pricing calculations', () => {
    it('Should calculate default pricing for recurring subscription (variant 2 - $90 per week)', async () => {
      // Uses the default downpayment of $199
      const { stripeSubscriptionPricing } = await shopClient.query(
        GET_PRICING,
        {
          input: {
            productVariantId: 2,
          },
        }
      );
      const pricing: StripeSubscriptionPricing = stripeSubscriptionPricing;
      expect(pricing.downpaymentWithTax).toBe(19900);
      expect(pricing.recurringPriceWithTax).toBe(9000);
      expect(pricing.interval).toBe('week');
      expect(pricing.intervalCount).toBe(1);
      expect(pricing.dayRateWithTax).toBe(1402);
      expect(pricing.amountDueNowWithTax).toBe(
        pricing.totalProratedAmountWithTax + 19900
      );
      expect(pricing.schedule.name).toBe(
        '6 months, billed monthly, 199 downpayment'
      );
    });

    it('Should calculate pricing for recurring with $400 custom downpayment', async () => {
      const { stripeSubscriptionPricing } = await shopClient.query(
        GET_PRICING,
        {
          input: {
            productVariantId: 2,
            downpaymentWithTax: 40000,
          },
        }
      );
      // Default price is $90 a month with a downpayment of $199
      // With a downpayment of $400, the price should be ($400 - $199) / 12 = $16.75 lower, so $73,25
      const pricing: StripeSubscriptionPricing = stripeSubscriptionPricing;
      expect(pricing.downpaymentWithTax).toBe(40000);
      expect(pricing.recurringPriceWithTax).toBe(7325);
      expect(pricing.interval).toBe('week');
      expect(pricing.intervalCount).toBe(1);
      expect(pricing.dayRateWithTax).toBe(1402);
      expect(pricing.amountDueNowWithTax).toBe(
        pricing.totalProratedAmountWithTax + 40000
      );
    });

    it('Should throw an error when downpayment is below the schedules default', async () => {
      let error = '';
      await shopClient
        .query(GET_PRICING, {
          input: {
            productVariantId: 2,
            downpaymentWithTax: 0,
          },
        })
        .catch((e) => (error = e.message));
      expect(error).toContain('Downpayment cannot be lower than');
    });

    it('Should throw an error when downpayment is higher than the total subscription value', async () => {
      let error = '';
      await shopClient
        .query(GET_PRICING, {
          input: {
            productVariantId: 2,
            downpaymentWithTax: 990000, // max is 1080 + 199 = 1279
          },
        })
        .catch((e) => (error = e.message));
      expect(error).toContain('Downpayment cannot be higher than');
    });

    it('Should throw error when trying to use a downpayment for paid up front', async () => {
      let error = '';
      await shopClient
        .query(GET_PRICING, {
          input: {
            productVariantId: 1,
            downpaymentWithTax: 19900, // max is 540 + 199 = 739
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
      const { stripeSubscriptionPricing } = await shopClient.query(
        GET_PRICING,
        {
          input: {
            productVariantId: 2,
            downpaymentWithTax: 40000,
            startDate: in3Days.toISOString(),
          },
        }
      );
      const pricing: StripeSubscriptionPricing = stripeSubscriptionPricing;
      expect(pricing.downpaymentWithTax).toBe(40000);
      expect(pricing.recurringPriceWithTax).toBe(7325);
      expect(pricing.interval).toBe('week');
      expect(pricing.intervalCount).toBe(1);
      expect(pricing.dayRateWithTax).toBe(1402);
      expect(pricing.amountDueNowWithTax).toBe(
        pricing.totalProratedAmountWithTax + 40000
      );
    });

    it('Should calculate pricing for each variant of product', async () => {
      const { stripeSubscriptionPricingForProduct } = await shopClient.query(
        GET_PRICING_FOR_PRODUCT,
        {
          productId: 1,
        }
      );
      const pricing: StripeSubscriptionPricing[] =
        stripeSubscriptionPricingForProduct;
      expect(pricing[1].downpaymentWithTax).toBe(19900);
      expect(pricing[1].recurringPriceWithTax).toBe(9000);
      expect(pricing[1].interval).toBe('week');
      expect(pricing[1].intervalCount).toBe(1);
      expect(pricing[1].dayRateWithTax).toBe(1402);
      expect(pricing[1].amountDueNowWithTax).toBe(
        pricing[1].totalProratedAmountWithTax + pricing[1].downpaymentWithTax
      );
      expect(pricing.length).toBe(2);
    });

    it('Should calculate default pricing for paid up front (variant 1 - $540 per 6 months)', async () => {
      const { stripeSubscriptionPricing } = await shopClient.query(
        GET_PRICING,
        {
          input: {
            productVariantId: 1,
          },
        }
      );
      const pricing: StripeSubscriptionPricing = stripeSubscriptionPricing;
      expect(pricing.downpaymentWithTax).toBe(0);
      expect(pricing.recurringPriceWithTax).toBe(54000);
      expect(pricing.interval).toBe('month');
      expect(pricing.intervalCount).toBe(6);
      expect(pricing.dayRateWithTax).toBe(296);
      expect(pricing.amountDueNowWithTax).toBe(
        pricing.totalProratedAmountWithTax + 54000
      );
    });

    it('Should calculate pricing for fixed start date', async () => {
      const future = new Date('01-01-2099');
      const variant: VariantForCalculation = {
        id: 'fixed',
        priceWithTax: 6000,
        customFields: {
          subscriptionSchedule: new Schedule({
            name: 'Monthly, fixed start date',
            durationInterval: SubscriptionInterval.Month,
            durationCount: 6,
            billingInterval: SubscriptionInterval.Month,
            billingCount: 1,
            startMoment: SubscriptionStartMoment.FixedStartdate,
            fixedStartDate: future,
            downpaymentWithTax: 6000,
            useProration: false,
            autoRenew: false,
          }),
        },
      };
      const pricing = calculateSubscriptionPricing(variant);
      expect(pricing.subscriptionStartDate).toBe(future);
      expect(pricing.recurringPriceWithTax).toBe(6000);
      expect(pricing.dayRateWithTax).toBe(230);
      expect(pricing.amountDueNowWithTax).toBe(6000);
      expect(pricing.proratedDays).toBe(0);
      expect(pricing.totalProratedAmountWithTax).toBe(0);
      expect(pricing.subscriptionEndDate).toBeDefined();
    });

    it('Should calculate pricing for time_of_purchase', async () => {
      const variant: VariantForCalculation = {
        id: 'fixed',
        priceWithTax: 6000,
        customFields: {
          subscriptionSchedule: new Schedule({
            name: 'Monthly, fixed start date',
            durationInterval: SubscriptionInterval.Month,
            durationCount: 6,
            billingInterval: SubscriptionInterval.Month,
            billingCount: 1,
            startMoment: SubscriptionStartMoment.TimeOfPurchase,
            downpaymentWithTax: 6000,
            useProration: true,
          }),
        },
      };
      const pricing = calculateSubscriptionPricing(variant);
      const now = new Date().toISOString().split('T')[0];
      const subscriptionStartDate = pricing.subscriptionStartDate
        .toISOString()
        .split('T')[0];
      // compare dates without time
      expect(subscriptionStartDate).toBe(now);
      expect(pricing.recurringPriceWithTax).toBe(6000);
      expect(pricing.dayRateWithTax).toBe(230);
      expect(pricing.amountDueNowWithTax).toBe(6000);
      expect(pricing.proratedDays).toBe(0);
      expect(pricing.totalProratedAmountWithTax).toBe(0);
    });
  });

  describe('Subscription order placement', () => {
    it('Should create payment intent for order with 2 subscriptions', async () => {
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
      await shopClient.query(ADD_ITEM_TO_ORDER, {
        productVariantId: '3',
        quantity: 1,
      });
      const { activeOrder } = await shopClient.query(GET_ORDER_WITH_PRICING);
      order = activeOrder;
      await setShipping(shopClient);
      const { createStripeSubscriptionIntent: secret } = await shopClient.query(
        CREATE_PAYMENT_LINK
      );
      expect(secret).toBe('mock-secret-1234');
      expect(paymentIntentInput.setup_future_usage).toBe('off_session');
      expect(paymentIntentInput.customer).toBe('customer-test-id');
      const weeklyDownpayment = 19900;
      const paidInFullTotal = 54000;
      const nonSubPrice = 12300;
      // Should be greater then or equal, because we can have proration, which is dynamic
      expect(parseInt(paymentIntentInput.amount)).toBeGreaterThanOrEqual(
        paidInFullTotal + weeklyDownpayment + nonSubPrice
      );
    });

    it('Should have pricing and schedule on order line', async () => {
      const { activeOrder } = await shopClient.query(GET_ORDER_WITH_PRICING);
      const line: OrderLineWithSubscriptionFields = activeOrder.lines[1];
      expect(line.subscriptionPricing).toBeDefined();
      expect(line.subscriptionPricing?.schedule).toBeDefined();
      expect(line.subscriptionPricing?.schedule.name).toBeDefined();
      expect(line.subscriptionPricing?.schedule.downpaymentWithTax).toBe(19900);
      expect(line.subscriptionPricing?.schedule.durationInterval).toBe('month');
      expect(line.subscriptionPricing?.schedule.durationCount).toBe(3);
      expect(line.subscriptionPricing?.schedule.billingInterval).toBe('week');
      expect(line.subscriptionPricing?.schedule.billingCount).toBe(1);
      expect(line.subscriptionPricing?.schedule.paidUpFront).toBe(false);
    });

    let createdSubscriptions: any[] = [];
    it('Should create subscriptions on webhook succeed', async () => {
      // Mock API
      nock('https://api.stripe.com')
        .get(/customers.*/)
        .reply(200, { data: [{ id: 'customer-test-id' }] });
      nock('https://api.stripe.com')
        .post(/products.*/)
        .reply(200, {
          id: 'test-product',
        })
        .persist(true);
      nock('https://api.stripe.com')
        .post(/subscriptions.*/, (body) => {
          createdSubscriptions.push(body);
          return true;
        })
        .reply(200, {
          id: 'mock-sub',
          status: 'active',
        })
        .persist(true);
      let adminOrder = await getOrder(adminClient as any, order!.id as string);
      await adminClient.fetch(
        'http://localhost:3050/stripe-subscriptions/webhook',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'payment_intent.succeeded',
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
      await new Promise((resolve) => setTimeout(resolve, 2000));
      adminOrder = await getOrder(adminClient as any, order!.id as string);
      expect(adminOrder?.state).toBe('PaymentSettled');
      // Expect 3 subs: paidInFull, weekly and downpayment
      expect(createdSubscriptions.length).toBe(3);
    });

    it('Created paid in full subscription', async () => {
      const paidInFull = createdSubscriptions.find(
        (s) => s.description === 'Adult karate Paid in full'
      );
      expect(paidInFull?.customer).toBe('mock');
      expect(paidInFull?.proration_behavior).toBe('none');
      expect(paidInFull?.['items[0][price_data][unit_amount]']).toBe('54000');
      expect(paidInFull?.['items[0][price_data][recurring][interval]']).toBe(
        'month'
      );
      expect(
        paidInFull?.['items[0][price_data][recurring][interval_count]']
      ).toBe('6');
      const in6months = new Date();
      in6months.setMonth(in6months.getMonth() + 6);
      // Trial-end should be after atleast 6 months
      expect(parseInt(paidInFull?.trial_end)).toBeGreaterThan(
        in6months.getTime() / 1000
      );
    });

    it('Created weekly subscription', async () => {
      const weeklySub = createdSubscriptions.find(
        (s) => s.description === 'Adult karate Recurring'
      );
      expect(weeklySub?.customer).toBe('mock');
      expect(weeklySub?.proration_behavior).toBe('none');
      expect(weeklySub?.['items[0][price_data][unit_amount]']).toBe('9000');
      expect(weeklySub?.['items[0][price_data][recurring][interval]']).toBe(
        'week'
      );
      expect(
        weeklySub?.['items[0][price_data][recurring][interval_count]']
      ).toBe('1');
      const in7days = new Date();
      in7days.setDate(in7days.getDate() + 7);
      // Trial-end (startDate) should somewhere within the next 7 days
      expect(parseInt(weeklySub?.trial_end)).toBeLessThan(
        in7days.getTime() / 1000
      );
      const in3Months = new Date();
      in3Months.setMonth(in3Months.getMonth() + 3);
      // No autorenew, so cancel_at should be in ~3 months
      expect(parseInt(weeklySub?.cancel_at)).toBeGreaterThan(
        in3Months.getTime() / 1000
      );
    });

    it('Created downpayment subscription that renews 3 months from now', async () => {
      const downpaymentRequest = createdSubscriptions.find(
        (s) => s.description === 'Downpayment'
      );
      expect(downpaymentRequest?.customer).toBe('mock');
      expect(downpaymentRequest?.proration_behavior).toBe('none');
      expect(downpaymentRequest?.['items[0][price_data][unit_amount]']).toBe(
        '19900'
      );
      expect(
        downpaymentRequest?.['items[0][price_data][recurring][interval]']
      ).toBe('month');
      expect(
        downpaymentRequest?.['items[0][price_data][recurring][interval_count]']
      ).toBe('3');
      const in2Months = new Date();
      in2Months.setMonth(in2Months.getMonth() + 2); // Atleast 2 months in between (can also be 2 months and 29 days)
      // Downpayment should renew after duration (At least 2 months)
      expect(parseInt(downpaymentRequest?.trial_end)).toBeGreaterThan(
        in2Months.getTime() / 1000
      );
    });

    it(`All OrderEvents have ctx.req`, () => {
      expect.hasAssertions();
      orderEvents.forEach((event) => {
        expect(event.ctx.req).toBeDefined();
      });
    });
  });

  describe('Schedule management', () => {
    it('Creates a fixed-date schedule', async () => {
      const now = new Date().toISOString();
      const { upsertStripeSubscriptionSchedule: schedule } =
        await adminClient.query(UPSERT_SCHEDULES, {
          input: {
            name: '3 months, billed weekly, fixed date',
            downpaymentWithTax: 0,
            durationInterval: SubscriptionInterval.Month,
            durationCount: 3,
            startMoment: SubscriptionStartMoment.FixedStartdate,
            fixedStartDate: now,
            billingInterval: SubscriptionInterval.Week,
            billingCount: 1,
          },
        });
      expect(schedule.startMoment).toBe(SubscriptionStartMoment.FixedStartdate);
      expect(schedule.fixedStartDate).toBe(now);
    });

    it('Can retrieve Schedules', async () => {
      await adminClient.asSuperAdmin();
      const { stripeSubscriptionSchedules: schedules } =
        await adminClient.query(GET_SCHEDULES);
      expect(schedules[0]).toBeDefined();
      expect(schedules[0].id).toBeDefined();
    });

    it('Can delete Schedules', async () => {
      await adminClient.asSuperAdmin();
      const { upsertStripeSubscriptionSchedule: toBeDeleted } =
        await adminClient.query(UPSERT_SCHEDULES, {
          input: {
            name: '6 months, paid in full',
            downpaymentWithTax: 0,
            durationInterval: SubscriptionInterval.Month,
            durationCount: 6,
            startMoment: SubscriptionStartMoment.StartOfBillingInterval,
            billingInterval: SubscriptionInterval.Month,
            billingCount: 6,
          },
        });
      await adminClient.query(DELETE_SCHEDULE, { scheduleId: toBeDeleted.id });
      const { stripeSubscriptionSchedules: schedules } =
        await adminClient.query(GET_SCHEDULES);
      expect(
        schedules.find((s: any) => s.id == toBeDeleted.id)
      ).toBeUndefined();
    });

    it('Fails to create fixed-date without start date', async () => {
      expect.assertions(1);
      const promise = adminClient.query(UPSERT_SCHEDULES, {
        input: {
          name: '3 months, billed weekly, fixed date',
          downpaymentWithTax: 0,
          durationInterval: SubscriptionInterval.Month,
          durationCount: 3,
          startMoment: SubscriptionStartMoment.FixedStartdate,
          billingInterval: SubscriptionInterval.Week,
          billingCount: 1,
        },
      });
      await expect(promise).rejects.toThrow();
    });

    it('Fails to create paid-up-front with downpayment', async () => {
      expect.assertions(1);
      const promise = adminClient.query(UPSERT_SCHEDULES, {
        input: {
          name: 'Paid up front, $199 downpayment',
          downpaymentWithTax: 19900,
          durationInterval: SubscriptionInterval.Month,
          durationCount: 6,
          startMoment: SubscriptionStartMoment.StartOfBillingInterval,
          billingInterval: SubscriptionInterval.Month,
          billingCount: 6,
        },
      });
      await expect(promise).rejects.toThrow();
    });
  });
});
