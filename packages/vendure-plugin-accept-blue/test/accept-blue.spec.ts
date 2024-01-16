// TODO test if getPaymentMethods only works for logged in users. IMPORTANT

import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
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

let server: TestServer;
// eslint-disable-next-line @typescript-eslint/no-unused-vars --- FIXME
let adminClient: SimpleGraphQLClient;
// eslint-disable-next-line @typescript-eslint/no-unused-vars --- FIXME
let shopClient: SimpleGraphQLClient;
let serverStarted = false;

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
}, 60000);

afterEach(async () => {
  // FIXME nock.cleanAll();
});

it('Should start successfully', async () => {
  expect(serverStarted).toBe(true);
});

it('Creates Accept Blue payment method', async () => {
  expect(false).toBe(true);
});

describe('Shop API', () => {
  it('Previews subscriptions for variant', async () => {
    expect(false).toBe(true);
  });

  it('Previews subscriptions for product', async () => {
    expect(false).toBe(true);
  });

  it('Throws error when strategy returns a schedule that can not be mapped to Accept Blue frequency', async () => {
    expect(false).toBe(true);
  });

  it('Gets saved payment methods for logged in customer', async () => {
    expect(false).toBe(true);
  });

  it('Fails to get payment methods for anonymous customer', async () => {
    expect(false).toBe(true);
  });

  it('Adds item to order', async () => {
    // has subscription on orderline
    expect(false).toBe(true);
  });

  it('Adds payment to order', async () => {
    expect(false).toBe(true);
  });

  it('Created subscriptions at Accept Blue', async () => {
    expect(false).toBe(true);
  });
});

describe('Admin API', () => {
  // Just smoke test 1 call, so we know resolvers and schema are also loaded for admin API

  it('Gets saved payment methods for customer', async () => {
    expect(false).toBe(true);
  });
});
