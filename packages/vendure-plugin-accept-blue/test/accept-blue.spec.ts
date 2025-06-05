// TODO test if getPaymentMethods only works for logged in users. IMPORTANT

import {
  Customer,
  DefaultLogger,
  EventBus,
  LanguageCode,
  LogLevel,
  mergeConfig,
  Order,
  OrderLine,
} from '@vendure/core';
// @ts-ignore
import nock from 'nock';

import {
  createTestEnvironment,
  E2E_DEFAULT_CHANNEL_TOKEN,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import { DataSource } from 'typeorm';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SetShippingAddress } from '../../test/src/generated/shop-graphql';
import { initialData } from '../../test/src/initial-data';
import { AcceptBluePlugin, AcceptBlueSubscriptionEvent } from '../src';
import { acceptBluePaymentHandler } from '../src/service/accept-blue-handler';
import {
  AcceptBlueSubscription,
  MutationUpdateAcceptBlueSubscriptionArgs,
} from '../src/api/generated/graphql';
import { AcceptBlueTransactionEvent } from '../src/events/accept-blue-transaction-event';
import {
  AcceptBlueWebhook,
  AccountType,
  CheckPaymentMethodInput,
  NoncePaymentMethodInput,
  SecCode,
} from '../src/types';
import {
  ADD_ITEM_TO_ORDER,
  ADD_PAYMENT_TO_ORDER,
  CREATE_PAYMENT_METHOD,
  ELIGIBLE_AC_PAYMENT_METHODS,
  ELIGIBLE_PAYMENT_METHODS,
  GET_CUSTOMER_WITH_ID,
  GET_HISTORY_ENTRIES,
  GET_ORDER_BY_CODE,
  GET_SURCHARGES,
  GET_USER_SAVED_PAYMENT_METHOD,
  PREVIEW_SUBSCRIPTIONS_FOR_PRODUCT,
  PREVIEW_SUBSCRIPTIONS_FOR_VARIANT,
  REFUND_TRANSACTION,
  SET_SHIPPING_METHOD,
  TRANSITION_ORDER_TO,
  UPDATE_CARD_PAYMENT_METHOD,
  UPDATE_CHECK_PAYMENT_METHOD,
  UPDATE_SUBSCRIPTION,
} from './helpers/graphql-helpers';
import {
  checkChargeResult,
  createMockRecurringScheduleResult,
  createMockWebhook,
  createSignature,
  creditCardChargeResult,
  haydenSavedPaymentMethods,
  haydenZiemeCustomerDetails,
  mockCardTransaction,
} from './helpers/mocks';
import { waitFor } from '../../test/src/test-helpers';
import { gql } from 'graphql-tag';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;
let serverStarted = false;
let acceptBluePaymentMethod: any;
let nockInstance: nock.Scope;
/**
 * Most recently placed test order
 */
let placedOrder: Order | undefined;

let testingNonceToken = {
  source: 'nonce-1234567',
  expiry_year: 2025,
  expiry_month: 1,
  last4: '4444',
};

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      AcceptBluePlugin.init({
        vendureHost: 'https://my-vendure-backend.io',
      }),
    ],
  });
  ({ server, adminClient, shopClient } = createTestEnvironment(config));
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
  serverStarted = true;
  nockInstance = nock('https://api.accept.blue/api/v2/');
}, 60000);

afterEach(async () => {
  nock.cleanAll();
});

it('Should start successfully', async () => {
  expect(serverStarted).toBe(true);
});

it('Creates Accept Blue payment method', async () => {
  // Mock webhook retrieval
  nockInstance.get(`/webhooks`).reply(200, []);
  // Mock webhook creation
  let receivedWebhookCreation = false;
  nockInstance
    .post(`/webhooks`, () => {
      receivedWebhookCreation = true;
      return true;
    })
    .reply(200, <AcceptBlueWebhook>{
      id: 1234,
      active: true,
      description: 'Test webhook',
      signature: 'just-a-test-secret',
    });
  await adminClient.asSuperAdmin();
  ({ createPaymentMethod: acceptBluePaymentMethod } = await adminClient.query(
    CREATE_PAYMENT_METHOD,
    {
      input: {
        code: 'accept-blue',
        enabled: true,
        handler: {
          code: acceptBluePaymentHandler.code,
          arguments: [
            { name: 'apiKey', value: 'process.env.API_KEY' },
            {
              name: 'tokenizationSourceKey',
              value: 'tokenization mock',
            },
            {
              name: 'googlePayMerchantId',
              value: 'googlePayMerchantId mock',
            },
            {
              name: 'googlePayGatewayMerchantId',
              value: 'googlePayGatewayMerchantId mock',
            },
            {
              name: 'allowAmex',
              value: 'true',
            },
            {
              name: 'allowECheck',
              value: 'true',
            },
            {
              name: 'allowVisa',
              value: 'true',
            },
            {
              name: 'allowDiscover',
              value: 'true',
            },
            {
              name: 'allowMasterCard',
              value: 'true',
            },
            {
              name: 'allowGooglePay',
              value: 'true',
            },
            {
              name: 'allowApplePay',
              value: 'true',
            },
          ],
        },
        translations: [
          { languageCode: LanguageCode.en, name: 'Accept Blue Payment Method' },
        ],
      },
    }
  ));
  await waitFor(() => receivedWebhookCreation === true);
  expect(acceptBluePaymentMethod.id).toBeDefined();
  expect(receivedWebhookCreation).toBe(true);
});

describe('Shop API', () => {
  it('Returns enabled accept blue payment methods', async () => {
    const { eligibleAcceptBluePaymentMethods } = await shopClient.query(
      ELIGIBLE_AC_PAYMENT_METHODS
    );
    expect(eligibleAcceptBluePaymentMethods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'ECheck' }),
        expect.objectContaining({ name: 'Visa' }),
        expect.objectContaining({ name: 'MasterCard' }),
        expect.objectContaining({ name: 'Amex' }),
        expect.objectContaining({ name: 'Discover' }),
        expect.objectContaining({ name: 'GooglePay' }),
        expect.objectContaining({ name: 'ApplePay' }),
      ])
    );
    eligibleAcceptBluePaymentMethods.forEach((method: any) => {
      expect(method.tokenizationKey).toBe('tokenization mock');
      expect(method.googlePayMerchantId).toBe('googlePayMerchantId mock');
      expect(method.googlePayGatewayMerchantId).toBe(
        'googlePayGatewayMerchantId mock'
      );
    });
  });

  it('Returns surcharge configuration', async () => {
    nockInstance.get('/surcharge').reply(200, {
      card: {
        type: 'currency',
        value: 0,
      },
      check: {
        type: 'currency',
        value: 0,
      },
    });
    const { acceptBlueSurcharges } = await shopClient.query(GET_SURCHARGES);
    expect(acceptBlueSurcharges).toEqual({
      card: {
        type: 'currency',
        value: 0,
      },
      check: {
        type: 'currency',
        value: 0,
      },
    });
  });

  it('Previews subscriptions for variant', async () => {
    const { previewAcceptBlueSubscriptions } = await shopClient.query(
      PREVIEW_SUBSCRIPTIONS_FOR_VARIANT,
      { productVariantId: 'T_1' }
    );
    expect(previewAcceptBlueSubscriptions?.length).toBeGreaterThan(0);
    expect(previewAcceptBlueSubscriptions[0]?.variantId).toBe('T_1');
  });

  it('Previews subscriptions for product', async () => {
    const { previewAcceptBlueSubscriptionsForProduct } = await shopClient.query(
      PREVIEW_SUBSCRIPTIONS_FOR_PRODUCT,
      { productId: 'T_1' }
    );
    expect(previewAcceptBlueSubscriptionsForProduct?.length).toBeGreaterThan(0);
  });

  it('Gets saved payment methods for logged in customer', async () => {
    nockInstance
      .get(
        `/customers/${haydenZiemeCustomerDetails.id}/payment-methods?limit=100`
      )
      .reply(200, haydenSavedPaymentMethods);
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    // Set mock customerId on Vendure customer for this test
    await server.app
      .get(DataSource)
      .getRepository(Customer)
      .update(
        { id: 1 },
        {
          customFields: { acceptBlueCustomerId: haydenZiemeCustomerDetails.id },
        }
      );
    const {
      activeCustomer: { savedAcceptBluePaymentMethods },
    } = await shopClient.query(GET_USER_SAVED_PAYMENT_METHOD);
    expect(savedAcceptBluePaymentMethods?.length).toBe(
      haydenSavedPaymentMethods.length
    );
  });

  it('Fails to get payment methods for anonymous customer', async () => {
    //no network call made here so using nock is not necessary
    await shopClient.asAnonymousUser();
    const { activeCustomer } = await shopClient.query(
      GET_USER_SAVED_PAYMENT_METHOD
    );
    expect(activeCustomer?.savedAcceptBluePaymentMethods).toBeUndefined();
  });
});

describe('Payment with Saved Payment Method', () => {
  let subscriptionIds: number[] = [];

  it('Adds item to order and set shipping address', async () => {
    await shopClient.asAnonymousUser();
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    const { addItemToOrder: order } = await shopClient.query(
      ADD_ITEM_TO_ORDER,
      {
        productVariantId: '3',
        quantity: 1,
      }
    );
    await shopClient.query(SetShippingAddress, {
      input: {
        fullName: 'Hayden Shipping Name',
        streetLine1: 'Hayden Shipping Street 1',
        streetLine2: 'Hayden Shipping Street 2',
        city: 'City of Hayden',
        postalCode: '1234 XX',
        countryCode: 'US',
      },
    });
    // has subscription on orderline
    expect(order.lines[0].acceptBlueSubscriptions?.[0]?.variantId).toBe('T_3');
  });

  it('Returns eligible payment methods with acceptBlue fields', async () => {
    const { eligiblePaymentMethods } = await shopClient.query(
      ELIGIBLE_PAYMENT_METHODS
    );
    expect(eligiblePaymentMethods.length).toBe(1);
    const method = eligiblePaymentMethods[0];
    expect(method.acceptBlueHostedTokenizationKey).toBe('tokenization mock');
    expect(method.acceptBlueGooglePayMerchantId).toBe(
      'googlePayMerchantId mock'
    );
    expect(method.acceptBlueGooglePayGatewayMerchantId).toBe(
      'googlePayGatewayMerchantId mock'
    );
  });

  let patchCustomerRequest: any = {};

  it('Adds payment to order', async () => {
    const queryParams = {
      active: true,
      customer_number: haydenZiemeCustomerDetails.customer_number,
    };
    nockInstance
      .persist()
      .get(`/customers`)
      .query(queryParams)
      .reply(200, [haydenZiemeCustomerDetails]);
    // patch customer details
    nockInstance
      .patch(`/customers/${haydenZiemeCustomerDetails.id}`, (body) => {
        patchCustomerRequest = body;
        return true;
      })
      .reply(200, [haydenZiemeCustomerDetails]);
    // createRecurringSchedule
    const recurringRequests: any[] = [];
    nockInstance
      .persist()
      .post(
        `/customers/${haydenZiemeCustomerDetails.id}/recurring-schedules`,
        (body) => {
          recurringRequests.push(body);
          return true;
        }
      )
      .reply(201, createMockRecurringScheduleResult(6014));
    //createCharge
    nockInstance
      .persist()
      .post(`/transactions/charge`)
      .reply(201, checkChargeResult);
    const testPaymentMethod =
      haydenSavedPaymentMethods[haydenSavedPaymentMethods.length - 1];
    nockInstance
      .get(`/payment-methods/${testPaymentMethod.id}`)
      .reply(201, testPaymentMethod);
    await shopClient.query(SET_SHIPPING_METHOD, {
      id: [1],
    });
    await shopClient.query(TRANSITION_ORDER_TO, {
      state: 'ArrangingPayment',
    });
    const { addPaymentToOrder: order } = await shopClient.query(
      ADD_PAYMENT_TO_ORDER,
      {
        input: {
          method: acceptBluePaymentMethod.code,
          metadata: { paymentMethodId: testPaymentMethod.id },
        },
      }
    );
    placedOrder = order;
    subscriptionIds = order.lines
      .map((l: any) => l.customFields.acceptBlueSubscriptionIds)
      .flat();
    expect(order.state).toBe('PaymentSettled');
    expect(recurringRequests.length).toBe(1);
    expect(recurringRequests[0].amount).toBe(9);
  });

  it('Updated customer at Accept Blue', async () => {
    expect(patchCustomerRequest).toEqual({
      first_name: 'Hayden',
      last_name: 'Zieme',
      identifier: 'hayden.zieme12@hotmail.com',
      email: 'hayden.zieme12@hotmail.com',
      shipping_info: {
        first_name: 'Hayden',
        last_name: 'Shipping',
        street: 'Hayden Shipping Street 1',
        street2: 'Hayden Shipping Street 2',
        zip: '1234 XX',
        city: 'City of Hayden',
        country: 'US',
      },
      billing_info: { first_name: 'Hayden', last_name: 'Zieme' },
      phone: '029 1203 1336',
    });
  });

  it('Created subscriptions at Accept Blue', async () => {
    expect(subscriptionIds.length).toBeGreaterThan(0);
  });
});

describe('Payment with Credit Card Payment Method', () => {
  let createdSubscriptionIds: number[] = [];
  it('Adds item to order', async () => {
    await shopClient.asAnonymousUser();
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    const { addItemToOrder: order } = await shopClient.query(
      ADD_ITEM_TO_ORDER,
      {
        productVariantId: '1',
        quantity: 1,
      }
    );
    // has subscription on orderline
    expect(order.lines[0].acceptBlueSubscriptions?.[0]?.variantId).toBe('T_1');
  });

  it('Adds payment to order', async () => {
    //we need to use nock here for the following reasons,
    //getOrCreateCustomer
    const queryParams = {
      active: true,
      customer_number: haydenZiemeCustomerDetails.customer_number,
    };
    nockInstance
      .persist()
      .get(`/customers`)
      .query(queryParams)
      .reply(200, [haydenZiemeCustomerDetails]);
    //getAllPaymentMethods
    nockInstance
      .persist()
      .get(
        `/customers/${haydenZiemeCustomerDetails.id}/payment-methods?limit=100`
      )
      .reply(200, haydenSavedPaymentMethods);
    //createRecurringSchedule
    nockInstance
      .persist()
      .post(`/customers/${haydenZiemeCustomerDetails.id}/recurring-schedules`)
      .reply(201, createMockRecurringScheduleResult());
    //createCharge
    nockInstance
      .persist()
      .post(`/transactions/charge`)
      .reply(201, creditCardChargeResult);
    await shopClient.query(SET_SHIPPING_METHOD, {
      id: [1],
    });
    await shopClient.query(TRANSITION_ORDER_TO, {
      state: 'ArrangingPayment',
    });
    const metadata: NoncePaymentMethodInput = {
      source: testingNonceToken.source,
      expiry_year: testingNonceToken.expiry_year,
      expiry_month: testingNonceToken.expiry_month,
      last4: testingNonceToken.last4,
    };
    const { addPaymentToOrder: order } = await shopClient.query(
      ADD_PAYMENT_TO_ORDER,
      {
        input: {
          method: acceptBluePaymentMethod.code,
          metadata,
        },
      }
    );
    createdSubscriptionIds = order.lines
      .map((l: any) => l.customFields.acceptBlueSubscriptionIds)
      .flat();
    expect(order.state).toBe('PaymentSettled');
  });

  it('Created subscriptions at Accept Blue', async () => {
    expect(createdSubscriptionIds.length).toBeGreaterThan(0);
  });
});

describe('Payment with Check Payment Method', () => {
  let createdSubscriptionIds: number[] = [];
  it('Adds item to order', async () => {
    await shopClient.asAnonymousUser();
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    const { addItemToOrder: order } = await shopClient.query(
      ADD_ITEM_TO_ORDER,
      {
        productVariantId: '3',
        quantity: 1,
      }
    );
    // has subscription on orderline
    expect(order.lines[0].acceptBlueSubscriptions?.[0]?.variantId).toBe('T_3');
  });

  it('Adds payment to order', async () => {
    const queryParams = {
      active: true,
      customer_number: haydenZiemeCustomerDetails.customer_number,
    };
    nockInstance
      .persist()
      .get(`/customers`)
      .query(queryParams)
      .reply(200, [haydenZiemeCustomerDetails]);
    //getAllPaymentMethods
    nockInstance
      .persist()
      .get(
        `/customers/${haydenZiemeCustomerDetails.id}/payment-methods?limit=100`
      )
      .reply(200, haydenSavedPaymentMethods);
    //createRecurringSchedule
    nockInstance
      .persist()
      .post(`/customers/${haydenZiemeCustomerDetails.id}/recurring-schedules`)
      .reply(201, createMockRecurringScheduleResult());
    //createCharge
    nockInstance
      .persist()
      .post(`/transactions/charge`)
      .reply(201, checkChargeResult);
    await shopClient.query(SET_SHIPPING_METHOD, {
      id: [1],
    });
    await shopClient.query(TRANSITION_ORDER_TO, {
      state: 'ArrangingPayment',
    });
    const testCheck =
      haydenSavedPaymentMethods[haydenSavedPaymentMethods.length - 1];
    const metadata: CheckPaymentMethodInput = {
      name: testCheck.name!,
      routing_number: testCheck.routing_number!,
      account_number: testCheck.account_number!,
      account_type: testCheck.account_type! as AccountType,
      sec_code: testCheck.sec_code! as SecCode,
    };
    const { addPaymentToOrder: order } = await shopClient.query(
      ADD_PAYMENT_TO_ORDER,
      {
        input: {
          method: acceptBluePaymentMethod.code,
          metadata,
        },
      }
    );
    createdSubscriptionIds = order.lines
      .map((l: any) => l.customFields.acceptBlueSubscriptionIds)
      .flat();
    expect(order.state).toBe('PaymentSettled');
  });

  it('Created subscriptions at Accept Blue', async () => {
    expect(createdSubscriptionIds.length).toBeGreaterThan(0);
  });
});

describe('Payment with Google Pay', () => {
  let createdSubscriptionIds: number[] = [];

  it('Prepares an order for payment', async () => {
    await shopClient.asAnonymousUser();
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    const { addItemToOrder: order } = await shopClient.query(
      ADD_ITEM_TO_ORDER,
      {
        productVariantId: '3',
        quantity: 1,
      }
    );
    await shopClient.query(SET_SHIPPING_METHOD, {
      id: [1],
    });
    const { transitionOrderToState } = await shopClient.query(
      TRANSITION_ORDER_TO,
      {
        state: 'ArrangingPayment',
      }
    );
    // has subscription on orderline
    expect(order.lines[0].acceptBlueSubscriptions?.[0]?.variantId).toBe('T_3');
    expect(transitionOrderToState.state).toBe('ArrangingPayment');
  });

  it('Adds payment to order', async () => {
    // Nock create charge
    let chargeRequest: any = {};
    nockInstance
      .persist()
      .post(`/transactions/charge`, (req) => {
        chargeRequest = req;
        return true;
      })
      .reply(201, {
        reference_number: 1234,
        transaction: { id: 3333 },
      });
    // Nock get existing customer for Hayden
    nockInstance
      .persist()
      .get(`/customers`)
      .query(true)
      .reply(200, [haydenZiemeCustomerDetails]);
    // Nock create payment method from transaction
    let createPaymentMethodRequest: any = {};
    nockInstance
      .post(
        `/customers/${haydenZiemeCustomerDetails.id}/payment-methods`,
        (req) => {
          createPaymentMethodRequest = req;
          return true;
        }
      )
      .reply(200, {
        id: 6789,
      });
    // Nock create recurring schedule
    nockInstance
      .persist()
      .post(`/customers/${haydenZiemeCustomerDetails.id}/recurring-schedules`)
      .reply(201, createMockRecurringScheduleResult());

    const { addPaymentToOrder: order } = await shopClient.query(
      ADD_PAYMENT_TO_ORDER,
      {
        input: {
          method: acceptBluePaymentMethod.code,
          metadata: {
            source: 'googlepay',
            amount: 15.8,
            token: 'encrypted',
          },
        },
      }
    );
    createdSubscriptionIds = order.lines
      .map((l: any) => l.customFields.acceptBlueSubscriptionIds)
      .flat();
    expect(order.state).toBe('PaymentSettled');
    expect(chargeRequest.amount).toBe(15.8);
    expect(chargeRequest.source).toBe('googlepay');
    expect(chargeRequest.token).toBe('encrypted');
    expect(createPaymentMethodRequest.source).toBe('ref-1234');
  });

  it('Created subscriptions at Accept Blue', async () => {
    expect(createdSubscriptionIds.length).toBeGreaterThan(0);
  });
});

describe('Transactions', () => {
  let orderLineWithSubscription: OrderLine;

  it('Emits transaction event for incoming schedule payments webhook', async () => {
    const events: AcceptBlueTransactionEvent[] = [];
    server.app
      .get(EventBus)
      .ofType(AcceptBlueTransactionEvent)
      .subscribe((event) => events.push(event));
    // Get latest created subscription
    const subscriptionId = placedOrder?.lines
      .map((l: any) => l.customFields.acceptBlueSubscriptionIds)
      .flat()?.[0];
    const mockWebhook = createMockWebhook({ scheduleId: subscriptionId });
    const signature = createSignature('just-a-test-secret', mockWebhook);
    const result = await shopClient.fetch(
      `http://localhost:3050/accept-blue/webhook/${E2E_DEFAULT_CHANNEL_TOKEN}`,
      {
        method: 'POST',
        body: JSON.stringify(mockWebhook),
        headers: {
          'x-signature': signature,
        },
      }
    );
    expect(result.status).toBe(201);
    expect(events.length).toBe(1);
    orderLineWithSubscription = events[0].orderLine;
    const orderLine = events[0].orderLine;
    expect((orderLine.customFields as any).acceptBlueSubscriptionIds).toContain(
      subscriptionId
    );
    expect(orderLine.order.code).toBe(placedOrder?.code);
    expect(orderLine.order.customer?.emailAddress).toBeDefined();
  });

  it('Emits transaction event for incoming one-off payments webhook', async () => {
    const events: AcceptBlueTransactionEvent[] = [];
    server.app
      .get(EventBus)
      .ofType(AcceptBlueTransactionEvent)
      .subscribe((event) => events.push(event));
    const mockWebhook = createMockWebhook({
      customFields: { custom1: JSON.stringify([orderLineWithSubscription.id]) },
    });
    const signature = createSignature('just-a-test-secret', mockWebhook);
    const result = await shopClient.fetch(
      `http://localhost:3050/accept-blue/webhook/${E2E_DEFAULT_CHANNEL_TOKEN}`,
      {
        method: 'POST',
        body: JSON.stringify(mockWebhook),
        headers: {
          'x-signature': signature,
        },
      }
    );
    expect(result.status).toBe(201);
    expect(events.length).toBe(1);
    expect(events[0].orderLine.id).toBe(orderLineWithSubscription.id);
    expect(events[0].orderLine.order.code).toBe(placedOrder?.code);
    expect(events[0].orderLine.order.customer?.emailAddress).toBeDefined();
  });

  it('Has transactions per subscription', async () => {
    nockInstance
      .get(`/recurring-schedules/6014`)
      .reply(200, createMockRecurringScheduleResult(6014));
    nockInstance
      .get(`/recurring-schedules/6014/transactions`)
      .reply(200, [mockCardTransaction]);
    const { orderByCode } = await shopClient.query(GET_ORDER_BY_CODE, {
      code: placedOrder?.code,
    });
    const transaction =
      orderByCode.lines[0].acceptBlueSubscriptions[0].transactions[0];
    expect(transaction.status).toBe('settled');
    expect(transaction.cardDetails).toBeDefined();
    expect(transaction.amount).toBeDefined();
  });
});

describe('Payment method management', () => {
  it('Prepares a customer for payment method management', async () => {
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    // Set mock customerId on Vendure customer for this test
    await server.app
      .get(DataSource)
      .getRepository(Customer)
      .update(
        { id: 1 },
        {
          customFields: { acceptBlueCustomerId: haydenZiemeCustomerDetails.id },
        }
      );
  });

  it('Updates a card payment method', async () => {
    // Mock the get payment method call to verify it's a card
    nockInstance.get('/payment-methods/14969').reply(200, {
      id: 14969,
      payment_method_type: 'card',
      customer_id: haydenZiemeCustomerDetails.id,
    });
    // Mock the update payment method call
    nockInstance.patch('/payment-methods/14969').reply(200, {
      id: 14969,
      name: 'My Name Pinelab',
      expiry_month: 5,
      expiry_year: 2040,
      avs_address: 'Test street 12',
      avs_zip: 'test zip',
      card_type: 'visa',
    });
    const { updateAcceptBlueCardPaymentMethod } = await shopClient.query(
      UPDATE_CARD_PAYMENT_METHOD,
      {
        input: {
          id: 14969,
          avs_address: 'Test street 12',
          avs_zip: 'test zip',
          name: 'My Name Pinelab',
          expiry_month: 5,
          expiry_year: 2040,
        },
      }
    );
    expect(updateAcceptBlueCardPaymentMethod).toEqual({
      id: 14969,
      name: 'My Name Pinelab',
      expiry_month: 5,
      expiry_year: 2040,
      avs_address: 'Test street 12',
      avs_zip: 'test zip',
    });
  });

  it('Fails when trying to update a non-card payment method', async () => {
    // Mock the get payment method call to verify it's a card
    nockInstance.get('/payment-methods/14969').reply(200, {
      id: 14969,
      payment_method_type: 'check',
      customer_id: haydenZiemeCustomerDetails.id,
    });
    const updateRequest = shopClient.query(UPDATE_CARD_PAYMENT_METHOD, {
      input: {
        id: 14969,
        avs_address: 'Test street 12',
        avs_zip: 'test zip',
        name: 'My Name Pinelab',
        expiry_month: 5,
        expiry_year: 2040,
      },
    });
    await expect(updateRequest).rejects.toThrowError(
      "Payment method '14969' is not a card payment method"
    );
  });

  it('Fails when trying to update a card that does not belong to the customer', async () => {
    // Mock the get payment method call to verify it's a card
    nockInstance.get('/payment-methods/14969').reply(200, {
      id: 14969,
      payment_method_type: 'card',
      customer_id: 123456, // Not Hayden
    });
    const updateRequest = shopClient.query(UPDATE_CARD_PAYMENT_METHOD, {
      input: {
        id: 14969,
        avs_address: 'Test street 12',
        avs_zip: 'test zip',
        name: 'My Name Pinelab',
        expiry_month: 5,
        expiry_year: 2040,
      },
    });
    await expect(updateRequest).rejects.toThrowError(
      'You are not currently authorized to perform this action'
    );
  });

  it('Fails when not logged in', async () => {
    await shopClient.asAnonymousUser();
    const updateRequest = shopClient.query(UPDATE_CARD_PAYMENT_METHOD, {
      input: {
        id: 14969,
        avs_address: 'Test street 12',
        avs_zip: 'test zip',
        name: 'My Name Pinelab',
        expiry_month: 5,
        expiry_year: 2040,
      },
    });
    await expect(updateRequest).rejects.toThrowError(
      'You are not currently authorized to perform this action'
    );
  });

  it('Updates a card payment method as admin', async () => {
    await adminClient.asSuperAdmin();
    // Mock the get payment method call to verify it's a card
    nockInstance.get('/payment-methods/14969').reply(200, {
      id: 14969,
      payment_method_type: 'card',
      customer_id: haydenZiemeCustomerDetails.id,
    });
    // Mock the update payment method call
    nockInstance.patch('/payment-methods/14969').reply(200, {
      id: 14969,
      name: 'My Name Pinelab',
      expiry_month: 5,
      expiry_year: 2040,
      avs_address: 'Test street 12',
      avs_zip: 'test zip',
      card_type: 'visa',
    });
    const { updateAcceptBlueCardPaymentMethod } = await adminClient.query(
      UPDATE_CARD_PAYMENT_METHOD,
      {
        input: {
          id: 14969,
          avs_address: 'Test street 12',
          avs_zip: 'test zip',
          name: 'My Name Pinelab',
          expiry_month: 5,
          expiry_year: 2040,
        },
      }
    );
    expect(updateAcceptBlueCardPaymentMethod).toEqual({
      id: 14969,
      name: 'My Name Pinelab',
      expiry_month: 5,
      expiry_year: 2040,
      avs_address: 'Test street 12',
      avs_zip: 'test zip',
    });
  });

  it('Fails to update card as admin when not logged in', async () => {
    await adminClient.asAnonymousUser();
    const updateRequest = adminClient.query(UPDATE_CARD_PAYMENT_METHOD, {
      input: {
        id: 14969,
        avs_address: 'Test street 12',
        avs_zip: 'test zip',
        name: 'My Name Pinelab',
        expiry_month: 5,
        expiry_year: 2040,
      },
    });
    await expect(updateRequest).rejects.toThrowError(
      'You are not currently authorized to perform this action'
    );
  });

  it('Updates a check payment method as admin', async () => {
    await adminClient.asSuperAdmin();
    // Mock the get payment method call to verify it's a card
    nockInstance.get('/payment-methods/14969').reply(200, {
      id: 14969,
      payment_method_type: 'check',
      customer_id: haydenZiemeCustomerDetails.id,
    });
    // Mock the update payment method call
    nockInstance.patch('/payment-methods/14969').reply(200, {
      id: 14969,
      name: 'My Name Pinelab',
      routing_number: '011000138',
      account_type: 'savings',
      sec_code: 'PPD',
    });
    const { updateAcceptBlueCheckPaymentMethod } = await adminClient.query(
      UPDATE_CHECK_PAYMENT_METHOD,
      {
        input: {
          id: 14969,
          name: 'My Name Pinelab',
          routing_number: '011000138',
          account_type: 'savings',
          sec_code: 'PPD',
        },
      }
    );
    expect(updateAcceptBlueCheckPaymentMethod).toEqual({
      id: 14969,
      name: 'My Name Pinelab',
      routing_number: '011000138',
      account_type: 'savings',
      sec_code: 'PPD',
    });
  });

  it('Fails to update check as admin when not logged in', async () => {
    await adminClient.asAnonymousUser();
    const updateRequest = adminClient.query(UPDATE_CHECK_PAYMENT_METHOD, {
      input: {
        id: 14969,
        name: 'My Name Pinelab',
        routing_number: '011000138',
        account_type: 'savings',
        sec_code: 'PPD',
      },
    });
    await expect(updateRequest).rejects.toThrowError(
      'You are not currently authorized to perform this action'
    );
  });
});

describe('Admin API', () => {
  it('Refunds a transaction', async () => {
    await adminClient.asSuperAdmin();
    let refundRequest: any;
    nockInstance
      .post(`/transactions/refund`, (body) => {
        refundRequest = body;
        return true;
      })
      .reply(200, {
        version: 'version1',
        status: 'Partially Approved',
        error_message: 'Some error message',
        error_code: 'E100',
        error_details: { detail: 'An error detail object' },
        reference_number: 123,
      });
    const { refundAcceptBlueTransaction } = await adminClient.query(
      REFUND_TRANSACTION,
      {
        transactionId: 123,
        amount: 4567,
        cvv2: '999',
      }
    );
    expect(refundRequest.reference_number).toBe(123);
    expect(refundRequest.amount).toBe(45.67);
    expect(refundRequest.cvv2).toBe('999');
    expect(refundAcceptBlueTransaction.referenceNumber).toBe(123);
    expect(refundAcceptBlueTransaction.version).toBe('version1');
    expect(refundAcceptBlueTransaction.status).toBe('PartiallyApproved');
    expect(refundAcceptBlueTransaction.errorMessage).toBe('Some error message');
    expect(refundAcceptBlueTransaction.errorCode).toBe('E100');
    expect(refundAcceptBlueTransaction.errorDetails).toBe(
      '{"detail":"An error detail object"}'
    ); // Should be stringified
  });

  it('Fails to refund when not logged in', async () => {
    await adminClient.asAnonymousUser();
    let error: any;
    try {
      await adminClient.query(REFUND_TRANSACTION, {
        transactionId: 123,
        amount: 4567,
        cvv2: '999',
      });
    } catch (e) {
      error = e;
    }
    expect(error?.response?.errors?.[0]?.extensions.code).toEqual('FORBIDDEN');
  });

  it('Gets saved payment methods for customer', async () => {
    nockInstance
      .persist()
      .get(
        `/customers/${haydenZiemeCustomerDetails.id}/payment-methods?limit=100`
      )
      .reply(200, haydenSavedPaymentMethods);
    await adminClient.asSuperAdmin();
    const { customer } = await adminClient.query(GET_CUSTOMER_WITH_ID, {
      id: '1',
    });
    expect(customer?.savedAcceptBluePaymentMethods?.length).toBeGreaterThan(0);
  });

  it('Does not allow updating subscriptions by unauthorized admins', async () => {
    await adminClient.asAnonymousUser();
    const updateRequest = adminClient.query<
      { updateAcceptBlueSubscription: AcceptBlueSubscription },
      MutationUpdateAcceptBlueSubscriptionArgs
    >(UPDATE_SUBSCRIPTION, {
      input: {
        id: 123,
        active: false,
      },
    });
    await expect(updateRequest).rejects.toThrowError(
      'You are not currently authorized to perform this action'
    );
  });

  const events: AcceptBlueSubscriptionEvent[] = [];

  it('Updates a subscription', async () => {
    server.app
      .get(EventBus)
      .ofType(AcceptBlueSubscriptionEvent)
      .subscribe((event) => events.push(event));
    await adminClient.asSuperAdmin();
    const scheduleId = 6014; // This ID was created earlier in test, and added to an order
    let updateRequest: any;
    nockInstance
      .persist()
      .patch(`/recurring-schedules/${scheduleId}`, (body) => {
        updateRequest = body;
        return true;
      })
      .reply(200, createMockRecurringScheduleResult(scheduleId));
    const tenDaysFromNow = new Date();
    tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
    await adminClient.query<any, MutationUpdateAcceptBlueSubscriptionArgs>(
      UPDATE_SUBSCRIPTION,
      {
        input: {
          id: scheduleId,
          amount: 4321,
          active: false,
          frequency: 'biannually',
          nextRunDate: tenDaysFromNow,
          numLeft: 5,
          title: 'Updated title',
          receiptEmail: 'newCustomer@pinelab.studio',
        },
      }
    );
    expect(updateRequest).toEqual({
      active: false,
      title: 'Updated title',
      amount: 43.21,
      frequency: 'biannually',
      next_run_date: tenDaysFromNow.toISOString().substring(0, 10), // Take yyyy-mm-dd
      num_left: 5,
      receipt_email: 'newCustomer@pinelab.studio',
    });
  });

  it('Has created history entries', async () => {
    await adminClient.asSuperAdmin();
    const { order } = await adminClient.query(GET_HISTORY_ENTRIES, {
      id: placedOrder?.id,
    });
    const entry = order.history.items.find(
      (entry: any) => entry.type === 'ORDER_NOTE'
    );
    expect(entry?.data.note).toContain('Subscription updated:');
  });

  it('Has published Subscription Event', async () => {
    const event = events[0];
    expect(events.length).toBe(1);
    expect(event.subscription.id).toBe(6014);
    expect(event.type).toBe('updated');
  });
});
