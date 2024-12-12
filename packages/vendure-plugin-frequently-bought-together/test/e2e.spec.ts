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
} from '@vendure/core';
import { TestServer } from '@vendure/testing/lib/test-server';
import { expect, describe, beforeAll, afterAll, it, vi, test } from 'vitest';
import { FrequentlyBoughtTogetherPlugin } from '../src';
import gql from 'graphql-tag';
import { GetProductById, UpdateProductMutation } from './queries';
import { createSettledOrder } from '../../test/src/shop-utils';
import { waitFor } from '../../test/src/test-helpers';
import { testPaymentMethod } from '../../test/src/test-payment-method';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
    plugins: [
      FrequentlyBoughtTogetherPlugin.init({
        licenseKey: '123',
      }),
    ],
  });
  ({ server, adminClient, shopClient } = createTestEnvironment(config));
  const serverStart = server.init({
    initialData: {
      ...initialData,
      paymentMethods: [
        {
          name: testPaymentMethod.code,
          handler: { code: testPaymentMethod.code, arguments: [] },
        },
      ],
    },
    productsCsvPath: './test/products-import.csv',
  });
  await expect(serverStart).resolves.toEqual(undefined);
}, 60000);

afterAll(() => {
  return server.destroy();
});

it('Server should start', async () => {
  await expect(server.app.getHttpServer()).toBeDefined();
});

it('Manually adds a related product', async () => {
  await adminClient.asSuperAdmin();
  const { updateProduct } = await adminClient.query(UpdateProductMutation, {
    input: {
      id: 'T_1',
      customFields: {
        frequentlyBoughtWithIds: ['T_1'],
      },
    },
  });
  expect(updateProduct.customFields.frequentlyBoughtWith[0].id).toEqual('T_1');
});

it('Exposes the related product via the Shop API', async () => {
  const { product } = await shopClient.query(GetProductById, { id: 'T_1' });
  expect(product.frequentlyBoughtWith[0].id).toBe('T_1');
  expect(product.frequentlyBoughtWith[0].name).toBe('Laptop');
});

it('Places sample orders', async () => {
  // Each variant belongs to a different product for this test
  // T_1 is bought together with T_3 twice
  await createSettledOrder(shopClient, 1, true, [
    { id: 'T_1', quantity: 1 },
    { id: 'T_3', quantity: 1 },
  ]);
  await createSettledOrder(shopClient, 1, true, [
    { id: 'T_1', quantity: 1 },
    { id: 'T_2', quantity: 1 },
    { id: 'T_3', quantity: 1 },
  ]);
  // T_2 is bought together with T_3 once
  await createSettledOrder(shopClient, 1, true, [
    { id: 'T_2', quantity: 1 },
    { id: 'T_3', quantity: 1 },
  ]);
  /* This yields the following transaction matrix
   *  [1,3]
   *  [1,2,3]
   *  [2,3]
   * So product 1 should give us 3 and 2
   */
});

it('Triggers bought together calculation via admin API', async () => {
  await adminClient.query(
    gql`
      mutation {
        triggerFrequentlyBoughtTogetherCalculation
      }
    `
  );
  // We have to wait for async job processing to complete
  await waitFor(async () => {
    const { product } = await shopClient.query(GetProductById, { id: 'T_1' });
    if (product.frequentlyBoughtWith.length >= 2) {
      return product;
    }
  });
});

it('Get sorted relations via shop API', async () => {
  const { product: product1 } = await shopClient.query(GetProductById, {
    id: 'T_1',
  });
  // Should get [3,2] for T_1
  expect(product1.frequentlyBoughtWith.length).toBe(2);
  expect(product1.frequentlyBoughtWith[0].id).toBe('T_3');
  expect(product1.frequentlyBoughtWith[1].id).toBe('T_2');
  const { product: product2 } = await shopClient.query(GetProductById, {
    id: 'T_2',
  });
  // Should get [3,1] for T_2
  expect(product2.frequentlyBoughtWith.length).toBe(2);
  expect(product2.frequentlyBoughtWith[0].id).toBe('T_3');
  expect(product2.frequentlyBoughtWith[1].id).toBe('T_1');
});
