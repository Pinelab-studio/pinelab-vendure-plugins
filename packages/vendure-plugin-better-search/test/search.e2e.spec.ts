import {
  DefaultLogger,
  LogLevel,
  mergeConfig,
  OrderService,
  RequestContext,
  RequestContextService,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { addItem } from '../../test/src/shop-utils';
import { waitFor } from '../../test/src/test-helpers';
import { BetterSearchPlugin } from '../src';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [BetterSearchPlugin],
  });

  ({ server, adminClient, shopClient } = createTestEnvironment(config));
  await server.init({
    initialData,
    productsCsvPath: './test/search-products.csv',
    customerCount: 2,
  });
}, 30000);

afterAll(async () => {
  await server.destroy();
}, 100000);

it('Started the server', () => {
  expect(server.app.getHttpServer()).toBeDefined();
});

it('Creates 5 active orders', async () => {
  for (let i = 0; i < 5; i++) {
    await shopClient.asAnonymousUser();
    await addItem(shopClient, 'T_1', 1);
  }
  const ctx = await server.app.get(RequestContextService).create({
    apiType: 'admin',
  });
  const { items: orders } = await server.app.get(OrderService).findAll(ctx);
  expect(orders.length).toBe(5);
});
