// TODO test if getPaymentMethods only works for logged in users. IMPORTANT

import {
  DefaultLogger,
  LanguageCode,
  LogLevel,
  mergeConfig,
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
import { AcceptBluePlugin } from '../src';
import { initialData } from '../../test/src/initial-data';
import {
  ADD_ITEM_TO_ORDER,
  ADD_PAYMENT_TO_ORDER,
  CREATE_PAYMENT_METHOD,
  GET_CUSTOMER_WITH_ID,
  GET_USER_SAVED_PAYMENT_METHOD,
  PREVIEW_SUBSCRIPTIONS_FOR_PRODUCT,
  PREVIEW_SUBSCRIPTIONS_FOR_VARIANT,
  SET_SHIPPING_METHOD,
  TRANSITION_ORDER_TO,
  UPDATE_CUSTOMER_BLUE_ID,
} from './helpers';
import { acceptBluePaymentHandler } from '../src/api/accept-blue-handler';
import {
  AccountType,
  CheckPaymentMethodInput,
  CreditCardPaymentMethodInput,
  SecCode,
  TokenPaymentMethodInput,
} from '../src/types';
import { AcceptBlueClient } from '../src/api/accept-blue-client';
import axios from 'axios';
import {
  checkChargeResult,
  creditCardChargeResult,
  haydenZiemeCustomerDetails,
  heydenSavedPaymentMethods,
  recurringScheduleResult,
  tokenizedCreditCardChargeResult,
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

let testingCreditCardDetail = {
  card: '5555555555554444',
  expiry_year: 2025,
  expiry_month: 1,
  cvv2: '737',
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

  it.skip('Throws error when strategy returns a schedule that can not be mapped to Accept Blue frequency', async () => {
    expect(false).toBe(true);
  });

  it('Gets saved payment methods for logged in customer', async () => {
    //use nock here
    nockInstance
      .get(`/customers/${haydenZiemeCustomerDetails.id}/payment-methods`)
      .reply(200, heydenSavedPaymentMethods);
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
      heydenSavedPaymentMethods.length
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
  let creditCardSubscriptionIds: number[] = [];
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
      .get(`/customers/${haydenZiemeCustomerDetails.id}/payment-methods`)
      .reply(200, heydenSavedPaymentMethods);
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
    const metadata: CreditCardPaymentMethodInput = {
      card: testingCreditCardDetail.card,
      expiry_year: testingCreditCardDetail.expiry_year,
      expiry_month: testingCreditCardDetail.expiry_month,
      cvv2: testingCreditCardDetail.cvv2,
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
    creditCardSubscriptionIds = order.lines
      .map((l: any) => l.customFields.subscriptionIds)
      .flat();
    expect(order.state).toBe('PaymentSettled');
  });

  it('Created subscriptions at Accept Blue', async () => {
    nockInstance
      .persist()
      .get(`/recurring-schedules/${recurringScheduleResult.id}`)
      .reply(201, recurringScheduleResult);
    expect(creditCardSubscriptionIds.length).toBeGreaterThan(0);
    for (let id of creditCardSubscriptionIds) {
      const response = await acceptBlueClient.request(
        'get',
        `recurring-schedules/${id}`
      );
      expect(response?.id).toBe(id);
    }
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
      .get(`/customers/${haydenZiemeCustomerDetails.id}/payment-methods`)
      .reply(200, heydenSavedPaymentMethods);
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
    const workTestPaymentMethod =
      heydenSavedPaymentMethods[heydenSavedPaymentMethods.length - 1];
    const metadata: CheckPaymentMethodInput = {
      name: workTestPaymentMethod.name!,
      routing_number: workTestPaymentMethod.routing_number!,
      account_number: workTestPaymentMethod.account_number!,
      account_type: workTestPaymentMethod.account_type! as AccountType,
      sec_code: workTestPaymentMethod.sec_code! as SecCode,
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
      .map((l: any) => l.customFields.subscriptionIds)
      .flat();
    expect(order.state).toBe('PaymentSettled');
  });

  it('Created subscriptions at Accept Blue', async () => {
    //get recurring schedule with id
    nockInstance
      .persist()
      .get(`/recurring-schedules/${recurringScheduleResult.id}`)
      .reply(201, recurringScheduleResult);
    expect(checkSubscriptionIds.length).toBeGreaterThan(0);
    for (let id of checkSubscriptionIds) {
      const response = await acceptBlueClient.request(
        'get',
        `recurring-schedules/${id}`
      );
      expect(response?.id).toBe(id);
    }
  });
});

describe('Payment with Tokenized Card Payment Method', () => {
  let tokenizedPaymentSubscriptionIds: number[] = [];
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
      .get(`/customers/${haydenZiemeCustomerDetails.id}/payment-methods`)
      .reply(200, heydenSavedPaymentMethods);
    //createRecurringSchedule
    nockInstance
      .persist()
      .post(`/customers/${haydenZiemeCustomerDetails.id}/recurring-schedules`)
      .reply(201, recurringScheduleResult);
    //createCharge
    nockInstance
      .persist()
      .post(`/transactions/charge`)
      .reply(201, tokenizedCreditCardChargeResult);
    await shopClient.query(SET_SHIPPING_METHOD, {
      id: [1],
    });
    await shopClient.query(TRANSITION_ORDER_TO, {
      state: 'ArrangingPayment',
    });
    const acceptBlueHostedTokenizationUrl =
      'https://tokenization.develop.accept.blue/v2/tokenization/get-nonce';
    const sourceKey = 'process.env.ACCEPT_BLUE_TOKENIZATION_SOURCE_KEY';
    nock(acceptBlueHostedTokenizationUrl)
      .post('')
      .reply(200, { data: { nonce_token: 'nonce_token' } });
    const response = await axios.post(
      acceptBlueHostedTokenizationUrl,
      {
        card: testingCreditCardDetail.card,
        cvv2: testingCreditCardDetail.cvv2,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + btoa(sourceKey + ':'),
        },
      }
    );
    const metadata: TokenPaymentMethodInput = {
      source: `nonce-${response.data.nonce_token}`,
      expiry_month: testingCreditCardDetail.expiry_month,
      expiry_year: testingCreditCardDetail.expiry_year,
      last4: testingCreditCardDetail.last4,
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
    tokenizedPaymentSubscriptionIds = order.lines
      .map((l: any) => l.customFields.subscriptionIds)
      .flat();
    expect(order.state).toBe('PaymentSettled');
  });

  it('Created subscriptions at Accept Blue', async () => {
    nockInstance
      .persist()
      .get(`/recurring-schedules/${recurringScheduleResult.id}`)
      .reply(201, recurringScheduleResult);
    expect(tokenizedPaymentSubscriptionIds.length).toBeGreaterThan(0);
    for (let id of tokenizedPaymentSubscriptionIds) {
      const response = await acceptBlueClient.request(
        'get',
        `recurring-schedules/${id}`
      );
      expect(response?.id).toBe(id);
    }
  });
});

describe('Admin API', () => {
  // Just smoke test 1 call, so we know resolvers and schema are also loaded for admin API

  it('Gets saved payment methods for customer', async () => {
    nockInstance
      .persist()
      .get(`/customers/${haydenZiemeCustomerDetails.id}/payment-methods`)
      .reply(200, heydenSavedPaymentMethods);
    const { customer } = await adminClient.query(GET_CUSTOMER_WITH_ID, {
      id: '1',
    });
    expect(customer?.savedAcceptBluePaymentMethods?.length).toBeGreaterThan(0);
  });
});
