import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import {
  DefaultLogger,
  InitialData,
  LogLevel,
  mergeConfig,
  Order,
  OrderService,
  ProductVariant,
  ProductVariantService,
  ShippingMethodService,
} from '@vendure/core';
import { TestServer } from '@vendure/testing/lib/test-server';
import {
} from '../src';
import nock from 'nock';
import {
  createSettledOrder,
  testAddress,
  testCustomer,
} from '../../test/src/order-utils';
import {
} from '../src/ui/queries.graphql';
import fs from 'fs';
import path from 'path';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import { GoedgepicktController } from '../src/api/goedgepickt.controller';
import { GoedgepicktClient } from '../src/api/goedgepickt.client';
import { getOrder } from '../../test/src/admin-utils';

jest.setTimeout(20000);

describe('Goedgepickt plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let serverStarted = false;
  const ggConfig = {
    apiKey: 'test-api-key',
    webshopUuid: 'test-webshop-uuid',
    autoFulfill: true,
  };

  let pushProductsPayloads: any[] = [];
  let createOrderPayload: OrderInput;
  let webhookPayloads: any[] = [];
  let order: Order;
  const apiUrl = 'https://account.goedgepickt.nl/';
  // Update products
  nock(apiUrl)
    .persist(true)
    .post('/api/v1/products', (reqBody) => {
      pushProductsPayloads.push(reqBody);
      return true;
    })
    .reply(200, []);
  // Get products first-time (used by FullSync)
  nock(apiUrl).get('/api/v1/products').query(true).reply(200, {
    items: [],
  });
  // Get products second time
  nock(apiUrl)
    .get('/api/v1/products')
    .query(true)
    .reply(200, {
      items: [
        {
          sku: 'L2201308',
          stock: {
            freeStock: 33,
          },
        },
      ],
    });
  // Get products third-time
  nock(apiUrl).get('/api/v1/products').query(true).reply(200, {
    items: [],
  });
  // Create order
  nock(apiUrl)
    .post('/api/v1/orders', (reqBody) => {
      createOrderPayload = reqBody;
      return true;
    })
    .reply(200, {
      message: 'Order created',
      orderUuid: 'testUuid',
    });
  // Get webshops
  nock(apiUrl)
    .persist(true)
    .get('/api/v1/webshops')
    .reply(200, { items: [{ uuid: ggConfig.webshopUuid }] });
  // get webhooks
  nock(apiUrl).persist(true).get('/api/v1/webhooks').reply(200, { items: [] });
  // Update webhooks
  nock(apiUrl)
    .persist(true)
    .post('/api/v1/webhooks', (reqBody) => {
      webhookPayloads.push(reqBody);
      return true;
    })
    .reply(200, { webhookSecret: 'test-secret' });

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        adminListQueryLimit: 10000,
        port: 3105,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        EBoekhoudenPlugin.init({
          vendureHost: 'https://test-host',
        }),
      ],
    });

    ({ server, adminClient } = createTestEnvironment(config));
    await server.init({
      initialData: initialData as InitialData,
      productsCsvPath: '../test/src/products-import.csv',
    });
    serverStarted = true;
    await adminClient.asSuperAdmin();
  }, 60000);

  it('Should start successfully', async () => {
    await expect(serverStarted).toBe(true);
  });

  afterAll(() => {
    return server.destroy();
  });
});
