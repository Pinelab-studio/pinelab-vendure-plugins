import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import path from 'path';
import { initialData } from './initial-data';
import { VendureOrderClient } from '../src/';
import { describe, beforeAll, it, expect, afterAll, vi } from 'vitest';

const storage: any = {};
const window = {
  localStorage: {
    getItem: (key: string) => storage[key],
    setItem: (key: string, data: any) => (storage[key] = data),
    removeItem: (key: string) => (storage[key] = undefined),
  },
};
vi.stubGlobal('window', window);

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
    expect(server.app.getHttpServer).toBeDefined;
  });

  let client: VendureOrderClient;
  let latestEmittedEvent: any;

  it('Creates a client', async () => {
    client = new VendureOrderClient(
      'http://localhost:3050/shop-api',
      'channel-token'
    );
    expect(client).toBeInstanceOf(VendureOrderClient);
    expect(client.activeOrder).toBeUndefined();
    expect(client.eventBus).toBeDefined();
    client.eventBus.on('*', (type, e) => (latestEmittedEvent = e));
  });

  describe('Cart management', () => {
    it('Adds an item to order', async () => {
      const order = await client.addItemToOrder('T_1', 1);
      expect(order?.lines[0].quantity).toBe(1);
      expect(order?.lines[0].productVariant.id).toBe('T_1');
    });

    it('Emits "item-added" event, with quantity 1', async () => {
      expect(latestEmittedEvent).toEqual({
        productVariantId: 'T_1',
        quantity: 1,
      });
    });

    it('Retrieves active order', async () => {
      const order = await client.getActiveOrder();
      expect(order?.lines[0].quantity).toBe(1);
      expect(order?.lines[0].productVariant.id).toBe('T_1');
    });

    it.skip('Increases quantity to 3', async () => {
      expect(false).toBe(true);
    });

    it.skip('Emits "item-added" event, with quantity 2', async () => {
      expect(false).toBe(true);
    });

    it.skip('Removes the order line', async () => {
      expect(false).toBe(true);
    });

    it.skip('Emits "item-removed" event, with quantity 3', async () => {
      expect(false).toBe(true);
    });

    it.skip('Adds an item to order #2', async () => {
      expect(false).toBe(true);
    });

    it.skip('Removes all order lines', async () => {
      expect(false).toBe(true);
    });

    it.skip('Emits "item-removed" event, with quantity 1', async () => {
      expect(false).toBe(true);
    });

    it.skip('Adds an item to order #3', async () => {
      expect(false).toBe(true);
    });

    it.skip('Decreases quantity to 0', async () => {
      expect(false).toBe(true);
    });

    it.skip('Emits "item-removed" event, with quantity 1', async () => {
      expect(false).toBe(true);
    });

    it.skip('Adds an item to order #4', async () => {
      expect(false).toBe(true);
    });
  });

  describe('Checkout', () => {
    it.skip('Applies invalid coupon', async () => {
      expect(false).toBe(true);
    });

    it.skip('Applies valid coupon', async () => {
      expect(false).toBe(true);
    });

    it.skip('Emits "coupon-code-applied" event', async () => {
      expect(false).toBe(true);
    });

    it.skip('Removes coupon', async () => {
      expect(false).toBe(true);
    });

    it.skip('Emits "coupon-code-removed" event', async () => {
      expect(false).toBe(true);
    });

    it.skip('Adds customer', async () => {
      expect(false).toBe(true);
    });

    it.skip('Adds shipping address', async () => {
      expect(false).toBe(true);
    });

    it.skip('Adds billing address', async () => {
      expect(false).toBe(true);
    });

    it.skip('Sets shipping method', async () => {
      expect(false).toBe(true);
    });

    it.skip('Adds payment', async () => {
      expect(false).toBe(true);
    });

    it.skip('Gets order by code', async () => {
      expect(false).toBe(true);
    });
  });

  afterAll(() => {
    return server.destroy();
  });
});
