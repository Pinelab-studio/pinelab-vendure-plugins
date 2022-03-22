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
import gql from 'graphql-tag';
import { coinbaseHandler } from '../src/coinbase.handler';
import { CreatePaymentMethod } from '../../test/src/generated/admin-graphql';
import { AddItemToOrder } from '../../test/src/generated/shop-graphql';

const mockData = {
  redirectUrl: 'https://my-storefront/order',
  apiKey: 'myApiKey',
  sharedSecret: 'sharedSecret',
  methodCode: `coinbase-payment-${E2E_DEFAULT_CHANNEL_TOKEN}`,
};

describe('Coinbase payments', () => {
  let shopClient: SimpleGraphQLClient;
  let adminClient: SimpleGraphQLClient;
  let server: TestServer;
  let started = false;
  let order: Order;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        port: 3106,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [CoinbasePlugin],
    });

    ({ server, adminClient, shopClient } = createTestEnvironment(config));
    await server.init({
      initialData,
      productsCsvPath: '../test/src/products-import.csv',
      customerCount: 2,
    });
    started = true;
    await adminClient.asSuperAdmin();
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
              { name: 'sharedSecret', value: mockData.sharedSecret },
            ],
          },
        },
      }
    );
    expect(createPaymentMethod.code).toBe(mockData.methodCode);
  });

  it('Should prepare an order', async () => {
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    const { addItemToOrder } = await shopClient.query(AddItemToOrder, {
      productVariantId: 'T_1',
      quantity: 2,
    });
    order = addItemToOrder as Order;
    expect(order.code).toBeDefined();
  });
});
