import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { createCollection, getAllOrders } from '../../test/src/admin-utils';
import { LanguageCode } from '../../test/src/generated/admin-graphql';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { PopularityScoresPlugin } from '../src';
import {
  GET_COLLECTIONS_WITH_POPULARITY_SCORE,
  GET_PRODUCTS_WITH_POPULARITY_SCORES,
} from './helpers';
import { expect, describe, beforeAll, afterAll, it } from 'vitest';

describe('Sort by Popularity Plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        port: 3106,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        PopularityScoresPlugin.init({
          endpointSecret: 'test-secret',
        }),
      ],
      paymentOptions: {
        paymentMethodHandlers: [testPaymentMethod],
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
      productsCsvPath: '../test/src/products-import.csv',
      customerCount: 2,
    });
    serverStarted = true;
    await adminClient.asSuperAdmin();
  }, 60000);

  it('Should start successfully', async () => {
    expect(serverStarted).toBe(true);
  });

  it('Creates an empty collection', async () => {
    //FIX ME
    const collection = await createCollection(adminClient as any, {
      translations: [
        {
          languageCode: LanguageCode.En,
          name: 'test',
          slug: 'test',
          description: '',
        },
      ],
      filters: [],
      customFields: {},
    });
    expect(collection.name).toBe('test');
  });

  it('Should place a test orders', async () => {
    //FIX ME
    await createSettledOrder(shopClient as any, 1, true, [
      { id: 'T_2', quantity: 2 },
    ]);
    //FIX ME
    const orders = await getAllOrders(adminClient as any);
    expect(orders.length).toBe(1);
    expect(
      orders[0].lines.every((line) => line.productVariant.product.id === 'T_1')
    ).toBe(true);
  });

  it('Fails for unauthenticated calls to calculate popularity endpoint', async () => {
    const res = await adminClient.fetch(
      `http://localhost:3106/popularity-scores/calculate-scores/e2e-default-channel/invalid-secreet`
    );
    expect(res.status).toBe(401);
  });

  it('Calls endpoint to calculate popularity', async () => {
    const res = await adminClient.fetch(
      `http://localhost:3106/popularity-scores/calculate-scores/e2e-default-channel/test-secret`
    );
    expect(res.status).toBe(200);
  });

  it('Calculated popularity per product', async () => {
    await new Promise((r) => setTimeout(r, 1000)); // Wait for worker to finish
    const {
      products: { items: products },
    } = await adminClient.query(GET_PRODUCTS_WITH_POPULARITY_SCORES);
    expect(products[0].customFields.popularityScore).toBe(1000); // Just one product in test for now
  });

  it('Calculated popularity per collection', async () => {
    const {
      collections: { items: collections },
    } = await adminClient.query(GET_COLLECTIONS_WITH_POPULARITY_SCORE);
    const electronics = collections.find(
      (col: any) => col.name === 'Electronics'
    );
    const computers = collections.find((col: any) => col.name === 'Computers');
    const testCol = collections.find((col: any) => col.name === 'test');
    expect(electronics.customFields.popularityScore).toBe(1000);
    expect(computers.customFields.popularityScore).toBe(1000);
    expect(testCol.customFields.popularityScore).toBe(0);
  });

  afterAll(async () => {
    return server.destroy();
  });
});
