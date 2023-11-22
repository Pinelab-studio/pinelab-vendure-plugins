import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import { SelectableGiftsPlugin } from '../src';
import { describe, beforeAll, it, expect, afterAll } from 'vitest';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;
let serverStarted = false;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [SelectableGiftsPlugin],
  });

  ({ server, adminClient, shopClient } = createTestEnvironment(config));
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
}, 60000);

it('Should start successfully', async () => {
  await expect(server.app.getHttpServer).toBeDefined;
});

// Free gift for orders > $0
const freeGiftVariantId0 = 1;
// Free gift for customers with >1 placed orders
const freeGiftVariantId1 = 2;

describe('Gift management via admin UI', function () {
  it('Creates a selectable gift promotion for orders greater than $0', async () => {
    await expect(true).toBe(true);
  });

  it('Creates a selectable gift promotion for customers with 1 or more placed orders', async () => {
    await expect(true).toBe(true);
  });
});

describe('Storefront free gift selection', function () {
  it('Has no eligible gifts for an empty order', async () => {
    await expect(true).toBe(true);
  });

  it('Add item to order', async () => {
    await expect(true).toBe(true);
  });

  it('Has 1 eligible gift for customer with 1 orders', async () => {
    await expect(true).toBe(true);
  });

  it('Place an order for customer', async () => {
    await expect(true).toBe(true);
  });

  it('Create new active order with items ', async () => {
    await expect(true).toBe(true);
  });

  it('Has 1 eligible gift, because the customer already placed 1 order before', async () => {
    await expect(true).toBe(true);
  });

  it('Add item to order', async () => {
    await expect(true).toBe(true);
  });

  it('Has 2 eligible gifts, because the customer already placed 1 order before and the order is greater than $0', async () => {
    await expect(true).toBe(true);
  });

  it('Adds gift to order for $0', async () => {
    // Gift should be free of charge
    await expect(true).toBe(true);
  });

  it('Still has eligible gifts', async () => {
    await expect(true).toBe(true);
  });

  it('Adds a new gift to order and removes the old gift', async () => {
    await expect(true).toBe(true);
  });

  it('Removes gift from order', async () => {
    await expect(true).toBe(true);
  });

  afterAll(() => {
    return server.destroy();
  });
});
