import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { ExamplePlugin } from '../src/example.plugin';
import { initialData } from './initial-data';
import path from 'path';

describe('Vendure order client', () => {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
    });

    ({ server, adminClient, shopClient } = createTestEnvironment(config));
    await server.init({
      initialData,
      productsCsvPath: path.join(__dirname, './product-import.csv'),
    });
  }, 60000);

  it('Starts the server successfully', async () => {
    await expect(server.app.getHttpServer).toBeDefined;
  });

  describe('Product management', () => {
    it('Adds an item to order', async () => {
      await expect(false).toBe(true);
    });

    it('Emits "item-added" event, with quantity 1', async () => {
      await expect(false).toBe(true);
    });

    it('Increases quantity to 3', async () => {
      await expect(false).toBe(true);
    });

    it('Emits "item-added" event, with quantity 2', async () => {
      await expect(false).toBe(true);
    });

    it('Removes the order line', async () => {
      await expect(false).toBe(true);
    });

    it('Emits "item-removed" event, with quantity 3', async () => {
      await expect(false).toBe(true);
    });

    it('Adds an item to order #2', async () => {
      await expect(false).toBe(true);
    });

    it('Removes all order lines', async () => {
      await expect(false).toBe(true);
    });

    it('Emits "item-removed" event, with quantity 1', async () => {
      await expect(false).toBe(true);
    });

    it('Adds an item to order #3', async () => {
      await expect(false).toBe(true);
    });

    it('Decreases quantity to 0', async () => {
      await expect(false).toBe(true);
    });

    it('Emits "item-removed" event, with quantity 1', async () => {
      await expect(false).toBe(true);
    });

    it('Adds an item to order #4', async () => {
      await expect(false).toBe(true);
    });
  });

  describe('Checkout', () => {
    it('Applies invalid coupon', async () => {
      await expect(false).toBe(true);
    });

    it('Applies valid coupon', async () => {
      await expect(false).toBe(true);
    });

    it('Emits "coupon-code-applied" event', async () => {
      await expect(false).toBe(true);
    });

    it('Removes coupon', async () => {
      await expect(false).toBe(true);
    });

    it('Emits "coupon-code-removed" event', async () => {
      await expect(false).toBe(true);
    });

    it('Applies coupon again', async () => {
      await expect(false).toBe(true);
    });

    // TODO customer, shipping address, shipping method, payment
  });

  afterAll(() => {
    return server.destroy();
  });
});
