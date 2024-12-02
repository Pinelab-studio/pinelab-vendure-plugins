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
let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      FrequentlyBoughtTogetherPlugin.init({
        maxRelatedProducts: 10,
      }),
    ],
  });
  ({ server, adminClient, shopClient } = createTestEnvironment(config));
  const serverStart = server.init({
    initialData: initialData as InitialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
  await expect(serverStart).resolves.toEqual(undefined);
}, 60000);

afterAll(() => {
  return server.destroy();
});

it('Server should start', async () => {
  await expect(server.app.getHttpServer()).toBeDefined();
});

it('Adds a related product', async () => {
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
  expect(product.customFields.frequentlyBoughtWith[0].id).toBe('T_1');
  expect(product.customFields.frequentlyBoughtWith[0].name).toBe('Laptop');
});
