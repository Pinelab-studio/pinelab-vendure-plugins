import { DefaultLogger, LogLevel, mergeConfig, Product } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { initialData } from '../../test/src/initial-data';
import { SortByPopularityPlugin } from '../src/index';
import { createSettledOrder } from '../../test/src/shop-utils';
import { getAllOrders } from '../../test/src/admin-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';

jest.setTimeout(10000);

describe('Limit variants per order plugin', function () {
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
      plugins: [SortByPopularityPlugin],
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

  it('Should place test orders', async () => {
    for (let i = 0; i < 5; i++) {
      await createSettledOrder(shopClient, 1);
    }
    const orders = await getAllOrders(adminClient);
    expect(orders.length).toBe(5);
    // Expect all orders to be from the same product
    expect(
      orders.every((order) =>
        order.lines.every((line) => line.productVariant.product.id === 'T_1')
      )
    ).toBe(true);
  });

  let products: Product[];
  let collections: Product[];

  it('Calls webhook to calculate popularity', async () => {
    // TODO Verify that the api call to order-by-popularity/calculate-scores was successfull.
    expect(false).toBe(true);
  });

  it('Calculated popularity per product', async () => {
    // TODO Popularity score is publicly available via the Shop GraphQL api
    // You might have to apply a delay here, because we will be doing the calculation in the worker
    expect(false).toBe(true);
  });

  it('Calculated popularity per collection', async () => {
    // TODO Popularity score is publicly available via the Shop GraphQL api
    expect(false).toBe(true);
  });

  it('Calculated popularity for parent collections', async () => {
    expect(false).toBe(true);
  });

  afterAll(() => {
    return server.destroy();
  });
});
