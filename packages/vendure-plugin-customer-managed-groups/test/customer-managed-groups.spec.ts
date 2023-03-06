import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { CustomerGroupExtensionsPlugin } from '../src';

describe('Example plugin e2e', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [CustomerGroupExtensionsPlugin],
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
  }, 60000);

  it('Should start successfully', async () => {
    await expect(server.app.getHttpServer).toBeDefined;
  });

  it('Adds a customer to my group', async () => {
    // TODO should now be admin
    await expect(true).toBe(false);
  });

  it('Disallows the participant to create another group', async () => {
    await expect(true).toBe(false);
  });

  it('Appoints a group admin as administrator', async () => {
    await expect(true).toBe(false);
  });

  it('Removes an admin from the group ', async () => {
    // Should also remove the admin relation
    await expect(true).toBe(false);
  });

  it('Places an order for the group participant', async () => {
    await expect(true).toBe(false);
  });

  it('Places an order for the group admin', async () => {
    await expect(true).toBe(false);
  });

  it('Fetches 2 orders for the group admin', async () => {
    await expect(true).toBe(false);
  });

  it('Fetches 1 orders for the group participant', async () => {
    await expect(true).toBe(false);
  });

  afterAll(() => {
    return server.destroy();
  });
});
