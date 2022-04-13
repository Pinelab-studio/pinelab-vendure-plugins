import { DefaultLogger, LogLevel, mergeConfig, Order } from '@vendure/core';
import {
  createTestEnvironment,
  E2E_DEFAULT_CHANNEL_TOKEN,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';

import { initialData } from '../../test/src/initial-data';
import { CoinbasePlugin } from '../src/coinbase.plugin';
import { coinbaseHandler } from '../src/coinbase.handler';
import { CreatePaymentMethod } from '../../test/src/generated/admin-graphql';
import { addItem, setAddressAndShipping } from '../../test/src/shop-utils';
import nock from 'nock';
import axios, { AxiosInstance } from 'axios';
import { ChargeInput, ChargeResult } from '../src/coinbase.types';
import { getOrder } from '../../test/src/admin-utils';
import { CreatePaymentIntentMutation } from './queries';

const mockData = {
  redirectUrl: 'https://my-storefront/order',
  apiKey: 'myApiKey',
  methodCode: `coinbase-payment-${E2E_DEFAULT_CHANNEL_TOKEN}`,
};

describe('Coinbase payments', () => {
  let shopClient: SimpleGraphQLClient;
  let adminClient: SimpleGraphQLClient;
  let httpClient: AxiosInstance;
  let server: TestServer;
  let started = false;
  let order: Order;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        port: 3107,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [CoinbasePlugin],
    });
    httpClient = axios.create({ baseURL: 'http://localhost:3107' });
    httpClient.defaults.headers.common['Content-Type'] = 'application/json';
    ({ server, adminClient, shopClient } = createTestEnvironment(config));
    await server.init({
      initialData,
      productsCsvPath: '../test/src/products-import.csv',
      customerCount: 2,
    });
    started = true;
    await adminClient.asSuperAdmin();
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
  }, 60000);

  afterAll(async () => {
    await server.destroy();
  });

  it('Should start successfully', async () => {
    expect(started).toEqual(true);
  });

  it('Should add a Coinbase paymentMethod', async () => {
    const { createPaymentMethod } = await adminClient.query(
      CreatePaymentMethod,
      {
        input: {
          code: mockData.methodCode,
          name: 'Coinbase payment test',
          description: 'This is a Coinbase test payment method',
          enabled: true,
          handler: {
            code: coinbaseHandler.code,
            arguments: [
              { name: 'redirectUrl', value: mockData.redirectUrl },
              { name: 'apiKey', value: mockData.apiKey },
            ],
          },
        },
      }
    );
    expect(createPaymentMethod.code).toBe(mockData.methodCode);
  });

  it('Should fail payment intent without shipping', async () => {
    expect.assertions(1);
    order = await addItem(shopClient, 'T_2', 2);
    await shopClient.query(CreatePaymentIntentMutation).catch((error) => {
      expect(error).toBeDefined();
    });
  });

  it('Should create payment intent', async () => {
    let payload: ChargeInput;
    nock('https://api.commerce.coinbase.com/')
      .post('/charges', (reqBody) => {
        payload = reqBody;
        return true;
      })
      .reply(200, {
        data: { hosted_url: 'https://mock-hosted-checkout/charges' },
      });
    await setAddressAndShipping(shopClient, 'T_1');
    const { createCoinbasePaymentIntent } = await shopClient.query(
      CreatePaymentIntentMutation
    );
    expect(createCoinbasePaymentIntent).toBe(
      'https://mock-hosted-checkout/charges'
    );
    const adminOrder = await getOrder(adminClient, order.id as string);
    expect(payload!.metadata.channelToken).toBe(E2E_DEFAULT_CHANNEL_TOKEN);
    expect(payload!.metadata.orderCode).toBe(adminOrder!.code);
    expect(payload!.local_price.amount).toBe(
      (adminOrder!.totalWithTax / 100).toFixed(2)
    );
  });

  it('Should fail for malicious webhook', async () => {
    // Incoming webhook seems valid, but when retrieving the actual Charge by code from CB we see it is not confirmed
    nock('https://api.commerce.coinbase.com/')
      .get('/charges/coinbase-mock-id')
      .reply(200, {
        data: {
          hosted_url: 'https://mock-hosted-checkout/charges',
        },
      } as Partial<ChargeResult>);
    await httpClient.post('/payments/coinbase', {
      event: {
        type: 'charge:confirmed',
        data: {
          code: 'coinbase-mock-id',
          metadata: {
            orderCode: order.code,
            channelToken: E2E_DEFAULT_CHANNEL_TOKEN,
          },
        },
      },
    });
    const adminOrder = await getOrder(adminClient, order.id as string);
    expect(adminOrder?.state).toEqual('AddingItems');
  });

  it('Should settle order for valid webhook', async () => {
    nock('https://api.commerce.coinbase.com/')
      .get('/charges/coinbase-mock-id')
      .reply(200, {
        data: {
          confirmed_at: new Date(),
          hosted_url: 'https://mock-hosted-checkout/charges',
        },
      } as Partial<ChargeResult>);
    await httpClient.post('/payments/coinbase', {
      event: {
        type: 'charge:confirmed',
        data: {
          code: 'coinbase-mock-id',
          metadata: {
            orderCode: order.code,
            channelToken: E2E_DEFAULT_CHANNEL_TOKEN,
          },
        },
      },
    });
    const adminOrder = await getOrder(adminClient, order.id as string);
    expect(adminOrder?.state).toEqual('PaymentSettled');
  });
});
