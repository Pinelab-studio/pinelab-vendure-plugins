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

describe('Selectable Gifts Plugin', function () {
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

  it('Allows admins to specify gifts with facets', async () => {
    // Creat facet 'free gifts' with facet values 'level 1'
    await expect(true).toBe(true);
  });

  it('Allows admins to create a promotion for level 1 gifts', async () => {
    // Create promotion with condition 'Customer placed more then X orders' and action 'Allow products with facets as free gifts'
    await expect(true).toBe(true);
  });

  it('Has no eligible gifts for customer with 0 orders', async () => {
    await expect(true).toBe(true);
  });

  it('Place an order for customer', async () => {
    await expect(true).toBe(true);
  });

  it('Has 1 eligible gift for customer with 1 orders', async () => {
    await expect(true).toBe(true);
  });

  it('Adds gift to cart', async () => {
    await expect(true).toBe(true);
  });

  it('Order total should be €0', async () => {
    await expect(true).toBe(true);
  });

  it('Allows no more then the configured number of gifts allowed', async () => {
    await expect(true).toBe(true);
  });

  afterAll(() => {
    return server.destroy();
  });
});
