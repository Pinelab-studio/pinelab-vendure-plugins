import {
  DefaultLogger,
  EventBus,
  LogLevel,
  mergeConfig,
  Order,
  OrderPlacedEvent,
  OrderService,
  OrderStateTransitionEvent,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import gql from 'graphql-tag';
// @ts-ignore
import nock from 'nock';
// @ts-ignore
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { getOrder } from '../../test/src/admin-utils';
import { initialData } from '../../test/src/initial-data';
import { stripeSubscriptionHandler, StripeSubscriptionPlugin } from '../src';
import { DefaultStrategyTestWrapper } from './helpers/default-strategy-test-wrapper';
import {
  ADD_ITEM_TO_ORDER,
  CANCEL_ORDER,
  CREATE_PAYMENT_LINK,
  CREATE_PAYMENT_METHOD,
  ELIGIBLE_PAYMENT_METHODS,
  getDefaultCtx,
  getOneMonthFromNow,
  GET_ACTIVE_ORDER,
  GET_PAYMENT_METHODS,
  PREVIEW_SUBSCRIPTIONS,
  PREVIEW_SUBSCRIPTIONS_FOR_PRODUCT,
  REFUND_ORDER,
  setShipping,
} from './helpers/graphql-helpers';

describe('Stripe Subscription Plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        StripeSubscriptionPlugin.init({
          disableWebhookSignatureChecking: true,
          vendureHost: 'https://public-test-host.io',
          subscriptionStrategy: new DefaultStrategyTestWrapper(),
        }),
      ],
    });
    ({ server, adminClient, shopClient } = createTestEnvironment(config));
    await server.init({
      initialData,
      productsCsvPath: '../test/src/products-import.csv',
    });
    serverStarted = true;
  }, 60000);

  afterEach(async () => {
    nock.cleanAll();
  });

  it('Should start successfully', async () => {
    expect(serverStarted).toBe(true);
  });

  let orderEvents: (OrderStateTransitionEvent | OrderPlacedEvent)[] = [];

  it('Listens for OrderPlacedEvent and OrderStateTransitionEvents', async () => {
    // Used to test if all events have RequestContext defined
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

  const createdWebhooks: any[] = [];

  it('Creates Stripe Subscription payment method', async () => {
    // Catch outgoing webhook creation requests
    nock('https://api.stripe.com')
      .get(/webhook_endpoints.*/)
      .reply(200, { data: [] });
    nock('https://api.stripe.com')
      .post(/webhook_endpoints.*/, (body) => {
        createdWebhooks.push(body);
        return true;
      })
      .reply(200, {
        secret: 'whsec_testing',
      });
    await adminClient.asSuperAdmin();
    const { createPaymentMethod } = await adminClient.query(
      CREATE_PAYMENT_METHOD,
      {
        input: {
          translations: [
            {
              languageCode: 'en',
              name: 'Stripe test payment',
              description: 'This is a Stripe payment method',
            },
          ],
          code: 'stripe-subscription-method',
          enabled: true,
          checker: {
            code: 'has-stripe-subscription-products-checker',
            arguments: [],
          },
          handler: {
            code: stripeSubscriptionHandler.code,
            arguments: [
              {
                name: 'webhookSecret',
                value: '',
              },
              { name: 'apiKey', value: 'test-api-key' },
              { name: 'publishableKey', value: 'test-publishable-key' },
            ],
          },
        },
      }
    );
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Await asyncronous webhook creation
    expect(createPaymentMethod.id).toBe('T_1');
  });

  it('Created webhooks and saved webhook secrets', async () => {
    const { paymentMethods } = await adminClient.query(GET_PAYMENT_METHODS);
    const webhookSecret = paymentMethods.items[0].handler.args.find(
      (a) => a.name === 'webhookSecret'
    )?.value;
    expect(createdWebhooks.length).toBe(1);
    expect(paymentMethods.items[0].code).toBe('stripe-subscription-method');
    expect(webhookSecret).toBe('whsec_testing');
  });

  it('Previews subscription for variant', async () => {
    const {
      previewStripeSubscriptions: [subscription],
    } = await shopClient.query(PREVIEW_SUBSCRIPTIONS, {
      productVariantId: 'T_1',
    });
    expect(subscription).toEqual({
      name: 'Subscription Laptop 13 inch 8GB',
      amountDueNow: 129900,
      variantId: 'T_1',
      priceIncludesTax: false,
      recurring: {
        amount: 129900,
        interval: 'month',
        intervalCount: 1,
        startDate: getOneMonthFromNow().toISOString(),
        endDate: null,
      },
    });
  });

  it('Preview subscriptions for product', async () => {
    const { previewStripeSubscriptionsForProduct: subscriptions } =
      await shopClient.query(PREVIEW_SUBSCRIPTIONS_FOR_PRODUCT, {
        productId: 'T_1',
      });
    // T_2 is not a subscription, so it should not be in the preview result
    const nonSubscription = subscriptions.find((s) => s.variantId === 'T_2');
    expect(nonSubscription).toBeUndefined();
    expect(subscriptions.length).toBe(3);
  });

  it('Previews subscription for variant for via admin API', async () => {
    const {
      previewStripeSubscriptions: [subscription],
    } = await adminClient.query(PREVIEW_SUBSCRIPTIONS, {
      productVariantId: 'T_1',
    });
    expect(subscription).toEqual({
      name: 'Subscription Laptop 13 inch 8GB',
      amountDueNow: 129900,
      variantId: 'T_1',
      priceIncludesTax: false,
      recurring: {
        amount: 129900,
        interval: 'month',
        intervalCount: 1,
        startDate: getOneMonthFromNow().toISOString(),
        endDate: null,
      },
    });
  });

  it('Preview subscriptions for product via admin API', async () => {
    const { previewStripeSubscriptionsForProduct: subscriptions } =
      await adminClient.query(PREVIEW_SUBSCRIPTIONS_FOR_PRODUCT, {
        productId: 'T_1',
      });
    // T_2 is not a subscription, so it should not be in the preview result
    const nonSubscription = subscriptions.find((s) => s.variantId === 'T_2');
    expect(nonSubscription).toBeUndefined();
    expect(subscriptions.length).toBe(3);
  });

  let orderCode;

  it('Adds a subscription to order', async () => {
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    const { addItemToOrder: order } = await shopClient.query(
      ADD_ITEM_TO_ORDER,
      {
        productVariantId: 'T_1', // Is subscription
        quantity: 1,
      }
    );
    orderCode = order.code;
    expect(order.total).toBe(129900);
    expect(order.lines[0].stripeSubscriptions.length).toBe(1);
  });

  it('Adds a non-subscription item to order', async () => {
    const { addItemToOrder: order } = await shopClient.query(
      ADD_ITEM_TO_ORDER,
      {
        productVariantId: 'T_2', // Is subscription
        quantity: 1,
      }
    );
    orderCode = order.code;
    expect(order.lines[0].stripeSubscriptions.length).toBe(1);
    expect(order.lines[1].stripeSubscriptions.length).toBe(0);
  });

  it('Has subscriptions on an order line', async () => {
    const { activeOrder } = await shopClient.query(GET_ACTIVE_ORDER);
    expect(activeOrder.lines[0].stripeSubscriptions[0]).toEqual({
      name: 'Subscription Laptop 13 inch 8GB',
      amountDueNow: 129900,
      variantId: 'T_1',
      priceIncludesTax: false,
      recurring: {
        amount: 129900,
        interval: 'month',
        intervalCount: 1,
        startDate: getOneMonthFromNow().toISOString(),
        endDate: null,
      },
    });
  });

  it('Sets a shipping method and customer details', async () => {
    await setShipping(shopClient);
  });

  it('Exposes publishable key via eligible payment methods', async () => {
    const { eligiblePaymentMethods } = await shopClient.query(
      ELIGIBLE_PAYMENT_METHODS
    );
    expect(eligiblePaymentMethods[0].stripeSubscriptionPublishableKey).toBe(
      'test-publishable-key'
    );
  });

  it('Created a PaymentIntent', async () => {
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
        object: 'payment_intent',
      });
    const { createStripeSubscriptionIntent: intent } = await shopClient.query(
      CREATE_PAYMENT_LINK
    );
    expect(intent.clientSecret).toBe('mock-secret-1234');
    expect(intent.intentType).toBe('PaymentIntent');
    expect(paymentIntentInput.setup_future_usage).toBe('off_session');
    expect(paymentIntentInput.customer).toBe('customer-test-id');
    // (T_1 + T_2) * tax + shipping
    const totalDueNow = (129900 + 139900) * 1.2 + 500; // = 324260
    expect(paymentIntentInput.amount).toBe(String(totalDueNow));
  });

  let createdSubscriptions: any[] = [];

  it('Settles order on incoming succeeded webhook', async () => {
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
      .times(3)
      .reply(200, {
        id: 'mock-sub',
        status: 'active',
      });
    let adminOrder = await getOrder(adminClient, '1');
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
                orderCode,
                channelToken: 'e2e-default-channel',
                amount: adminOrder!.totalWithTax,
              },
            },
          },
        }),
      }
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    adminOrder = await getOrder(adminClient, '1');
    expect(adminOrder?.state).toBe('PaymentSettled');
  });

  it('Created subscriptions', async () => {
    expect(createdSubscriptions.length).toBe(1);
  });

  it('Saved subscriptionIds on order line', async () => {
    const ctx = await getDefaultCtx(server);
    const internalOrder = await server.app.get(OrderService).findOne(ctx, 1);
    const subscriptionIds: string[] = [];
    internalOrder?.lines.forEach((line) => {
      if (line.customFields.subscriptionIds) {
        subscriptionIds.push(...line.customFields.subscriptionIds);
      }
    });
    expect(subscriptionIds.length).toBe(1);
  });

  it('Should cancel subscription', async () => {
    // Mock API
    let subscriptionRequests: any[] = [];
    nock('https://api.stripe.com')
      .post(/subscriptions*/, (body) => {
        subscriptionRequests.push(body);
        return true;
      })
      .reply(200, {});
    await adminClient.query(CANCEL_ORDER, {
      input: {
        lines: [
          {
            orderLineId: 'T_1',
            quantity: 1,
          },
        ],
        orderId: 'T_1',
        reason: 'Customer request',
        cancelShipping: false,
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 500)); // Await worker processing
    expect(subscriptionRequests[0].cancel_at_period_end).toBe('true');
  });

  it('Should refund subscription', async () => {
    // Mock API
    let refundRequests: any = [];
    nock('https://api.stripe.com')
      .post(/refunds*/, (body) => {
        refundRequests.push(body);
        return true;
      })
      .reply(200, {});
    await adminClient.query(REFUND_ORDER, {
      input: {
        lines: [
          {
            orderLineId: 'T_1',
            quantity: 1,
          },
        ],
        reason: 'Customer request',
        shipping: 0,
        adjustment: 0,
        paymentId: 'T_1',
      },
    });
    expect(refundRequests[0].amount).toBeDefined();
  });

  it(`Published all OrderEvents with a ctx.req`, () => {
    expect.hasAssertions();
    orderEvents.forEach((event) => {
      expect(event.ctx.req).toBeDefined();
    });
  });
});
