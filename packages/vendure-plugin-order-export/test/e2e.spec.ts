import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import { DefaultLogger, LogLevel, mergeConfig, Order } from '@vendure/core';
import { TestServer } from '@vendure/testing/lib/test-server';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import {
  addShippingMethod,
  createSettledOrder,
} from '../../test/src/admin-utils';
import { getExports } from '../src/ui/queries.graphql';
import {
  OrderExportPlugin,
  OrderExportResultsQuery,
  OrderExportResultsQueryVariables,
} from '../src';
import { FakeExporter } from './fake-exporter';

jest.setTimeout(20000);

describe('Order export plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        port: 3107,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        OrderExportPlugin.init({
          strategies: [new FakeExporter()],
        }),
      ],
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
    await expect(serverStarted).toBe(true);
  });

  it('Gets order exports', async () => {
    await addShippingMethod(adminClient as any, 'manual-fulfillment');
    const orders = 3;
    for (let i = 1; i <= orders; i++) {
      await createSettledOrder(shopClient as any);
    }
    await adminClient.asSuperAdmin();
    const { orderExportResults: result } = await adminClient.query<
      OrderExportResultsQuery,
      OrderExportResultsQueryVariables
    >(getExports, {
      filter: { page: 0, itemsPerPage: 10 },
    });
    console.log(result);
    const orderExport = result.items[0];
    expect(result.totalItems).toBe(3);
    expect(orderExport.id).toBeDefined();
    expect(orderExport.customerEmail).toBeDefined();
    expect(orderExport.customerEmail).not.toEqual(null);
    expect(orderExport.orderPlacedAt).toBeDefined();
    expect(orderExport.orderPlacedAt).not.toEqual(null);
  });

  afterAll(() => {
    return server.destroy();
  });
});
