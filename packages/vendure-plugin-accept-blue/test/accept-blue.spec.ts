// TODO test if getPaymentMethods only works for logged in users. IMPORTANT

import {
  DefaultLogger,
  LanguageCode,
  LogLevel,
  mergeConfig,
  Order,
} from '@vendure/core';
// @ts-ignore
import nock from 'nock';

import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { AcceptBluePlugin } from '../src';
import { AcceptBlueClient } from '../src/api/accept-blue-client';
import { acceptBluePaymentHandler } from '../src/api/accept-blue-handler';
import {
  AccountType,
  CheckPaymentMethodInput,
  NoncePaymentMethodInput,
  SecCode,
} from '../src/types';
import {
  ADD_ITEM_TO_ORDER,
  ADD_PAYMENT_TO_ORDER,
  CREATE_PAYMENT_METHOD,
  GET_CUSTOMER_WITH_ID,
  GET_ORDER_BY_CODE,
  GET_USER_SAVED_PAYMENT_METHOD,
  PREVIEW_SUBSCRIPTIONS_FOR_PRODUCT,
  PREVIEW_SUBSCRIPTIONS_FOR_VARIANT,
  REFUND_TRANSACTION,
  SET_SHIPPING_METHOD,
  TRANSITION_ORDER_TO,
  UPDATE_CUSTOMER_BLUE_ID,
} from './helpers';
import {
  checkChargeResult,
  creditCardChargeResult,
  haydenSavedPaymentMethods,
  haydenZiemeCustomerDetails,
  mockCardTransaction,
  recurringScheduleResult,
} from './nock-helpers';

let server: TestServer;
// eslint-disable-next-line @typescript-eslint/no-unused-vars --- FIXME
let adminClient: SimpleGraphQLClient;
// eslint-disable-next-line @typescript-eslint/no-unused-vars --- FIXME
let shopClient: SimpleGraphQLClient;
let serverStarted = false;
let acceptBluePaymentMethod: any;
let nockInstance: nock.Scope;
let acceptBlueClient: AcceptBlueClient;
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
        // TODO create TestStrategy that creates invalid subscription
      }),
    ],
  });
  ({ server, adminClient, shopClient } = createTestEnvironment(config));
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
  serverStarted = true;
  acceptBlueClient = new AcceptBlueClient('process.env.API_KEY', '');
  nockInstance = nock(acceptBlueClient.endpoint);
}, 60000);

afterEach(async () => {
  nock.cleanAll();
});

it('Should start successfully', async () => {
  expect(serverStarted).toBe(true);
});

it('Selects dev mode if args.testMode=true', () => {
  const acceptBlueClient = new AcceptBlueClient(
    'process.env.API_KEY',
    '',
    true
  );
  expect(acceptBlueClient.endpoint).toContain('develop');
});

it('Processes query args', () => {
  const acceptBlueClient = new AcceptBlueClient(
    'process.env.API_KEY',
    '',
    true
  );
  expect(acceptBlueClient.toQueryString({})).toEqual('');
  expect(
    acceptBlueClient.toQueryString({
      order: 'asc',
      status: 'expired',
      payment_type: 'credit_card',
      limit: 12,
      offset: 1,
    })
  ).toEqual(
    'order=asc&status=expired&payment_type=credit_card&limit=12&offset=1'
  );
});

it('Creates Accept Blue payment method', async () => {
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
              value: 'process.env.ACCEPT_BLUE_TOKENIZATION_SOURCE_KEY',
            },
          ],
        },
        translations: [
          { languageCode: LanguageCode.en, name: 'Accept Blue Payment Method' },
        ],
      },
    }
  ));
  expect(acceptBluePaymentMethod.id).toBeDefined();
});

describe('Shop API', () => {
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
    const { updateCustomer } = await adminClient.query(
      UPDATE_CUSTOMER_BLUE_ID,
      { customerId: '1', acceptBlueCustomerId: haydenZiemeCustomerDetails.id }
    );
    expect(updateCustomer.emailAddress).toBe('hayden.zieme12@hotmail.com');
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
      .reply(201, recurringScheduleResult);
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
  let checkSubscriptionIds: number[] = [];
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
      .reply(201, recurringScheduleResult);
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
    checkSubscriptionIds = order.lines
      .map((l: any) => l.customFields.acceptBlueSubscriptionIds)
      .flat();
    expect(order.state).toBe('PaymentSettled');
  });

  it('Created subscriptions at Accept Blue', async () => {
    expect(checkSubscriptionIds.length).toBeGreaterThan(0);
  });
});

describe('Payment with Saved Payment Method', () => {
  let subscriptionIds: number[] = [];

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
    //createRecurringSchedule
    nockInstance
      .persist()
      .post(`/customers/${haydenZiemeCustomerDetails.id}/recurring-schedules`)
      .reply(201, recurringScheduleResult);
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
    const testPaymentMethod =
      haydenSavedPaymentMethods[haydenSavedPaymentMethods.length - 1];
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
  });

  it('Created subscriptions at Accept Blue', async () => {
    expect(subscriptionIds.length).toBeGreaterThan(0);
  });
});

describe('Refunds and transactions', () => {
  it('Has transactions per subscription', async () => {
    nockInstance
      .get(`/recurring-schedules/6014`)
      .reply(200, recurringScheduleResult);
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

  it('Refunds a transaction', async () => {
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
    const { refundAcceptBlueTransaction } = await shopClient.query(
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
    await shopClient.asAnonymousUser();
    let error: any;
    try {
      await shopClient.query(REFUND_TRANSACTION, {
        transactionId: 123,
        amount: 4567,
        cvv2: '999',
      });
    } catch (e) {
      error = e;
    }
    expect(error?.response?.errors?.[0]?.extensions.code).toEqual('FORBIDDEN');
  });
});

describe('Admin API', () => {
  // Just smoke test 1 call, so we know resolvers and schema are also loaded for admin API

  it('Gets saved payment methods for customer', async () => {
    nockInstance
      .persist()
      .get(
        `/customers/${haydenZiemeCustomerDetails.id}/payment-methods?limit=100`
      )
      .reply(200, haydenSavedPaymentMethods);
    const { customer } = await adminClient.query(GET_CUSTOMER_WITH_ID, {
      id: '1',
    });
    expect(customer?.savedAcceptBluePaymentMethods?.length).toBeGreaterThan(0);
  });
});
