import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import getFilesInAdminUiFolder from '../../test/src/compile-admin-ui.util';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { AdvancedMetricSummariesQuery, MetricsPlugin } from '../src';
import { GET_METRICS } from '../src/ui/queries.graphql';

describe('Metrics', () => {
  let shopClient: SimpleGraphQLClient;
  let adminClient: SimpleGraphQLClient;
  let server: TestServer;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const devConfig = mergeConfig(testConfig, {
      apiOptions: {
        port: 3050,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [MetricsPlugin],
      paymentOptions: {
        paymentMethodHandlers: [testPaymentMethod],
      },
    });
    const env = createTestEnvironment(devConfig);
    shopClient = env.shopClient;
    adminClient = env.adminClient;
    server = env.server;
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

  it('Creates 3 settled orders', async () => {
    const variants = [
      { id: 'T_1', quantity: 1 },
      { id: 'T_2', quantity: 2 },
    ];
    await createSettledOrder(shopClient, 1, true, variants);
    await createSettledOrder(shopClient, 1, true, variants);
    await createSettledOrder(shopClient, 1, true, variants);
  });

  it('Fails to fetch metrics when unauthenticated', async () => {
    const promise = adminClient.query(GET_METRICS);
    await expect(promise).rejects.toThrow('authorized');
  });

  it('Fetches metrics for past 14 months', async () => {
    await adminClient.asSuperAdmin();
    const { advancedMetricSummaries } =
      await adminClient.query<AdvancedMetricSummariesQuery>(GET_METRICS);
    expect.hasAssertions();
    const averageOrderValue = advancedMetricSummaries.find(
      (m) => m.code === 'aov'
    )!;
    const revenuePerProduct = advancedMetricSummaries.find(
      (m) => m.code === 'revenue-per-product'
    )!;
    const salesPerProduct = advancedMetricSummaries.find(
      (m) => m.code === 'units-sold'
    )!;
    [averageOrderValue, revenuePerProduct, salesPerProduct].forEach(
      (metric) => {
        expect(metric.series[0].values.length).toEqual(14);
        expect(metric.labels.length).toEqual(14);
      }
    );
    expect(averageOrderValue.series[0].values.length).toEqual(14);
    expect(averageOrderValue.labels.length).toEqual(14);
    // All orders are 4102 without tax, so the AOV is always 4102
    expect(averageOrderValue.series[0].values[13]).toEqual(4921.4); // Incl tax
    expect(averageOrderValue.series[1].values[13]).toEqual(4102);
    // All orders are 4102 without tax, and we placed 3 orders
    expect(Math.round(revenuePerProduct.series[0].values[13])).toEqual(
      3 * 4102
    ); // Incl tax
    expect(revenuePerProduct.series[0].values[13]).toEqual(3 * 4102); //12306
  });

  it('Fetches metrics for specific variant', async () => {
    await adminClient.asSuperAdmin();
    const { advancedMetricSummaries } =
      await adminClient.query<AdvancedMetricSummariesQuery>(GET_METRICS, {
        input: { variantIds: [1, 2] },
      });
    const revenuePerProduct = advancedMetricSummaries.find(
      (m) => m.code === 'revenue-per-product'
    )!;
    // For revenue per product we expect 2 series: one for each variant
    expect(revenuePerProduct.series[0].values.length).toEqual(14);
    expect(revenuePerProduct.series[1].values.length).toEqual(14);
    expect(revenuePerProduct.labels.length).toEqual(14);
    // Expect the first series (variant 1), to have 389700 revenue in last month
    expect(revenuePerProduct.series[0].values[13]).toEqual(3897);
    // Expect the first series (variant 2), to have 839400 revenue in last month
    expect(revenuePerProduct.series[1].values[13]).toEqual(8394);
    const salesPerProduct = advancedMetricSummaries.find(
      (m) => m.code === 'units-sold'
    )!;
    // For sales per product we expect 2 series: one for each variant
    expect(salesPerProduct.series[0].values.length).toEqual(14);
    expect(salesPerProduct.series[1].values.length).toEqual(14);
    expect(salesPerProduct.labels.length).toEqual(14);
    // Expect the first series (variant 1), to have 3 revenue in last month
    expect(salesPerProduct.series[0].values[13]).toEqual(3);
    // Expect the first series (variant 2), to have 6 revenue in last month
    expect(salesPerProduct.series[1].values[13]).toEqual(6);
  });

  if (process.env.TEST_ADMIN_UI) {
    it('Should compile admin', async () => {
      const files = await getFilesInAdminUiFolder(__dirname, MetricsPlugin.ui);
      expect(files?.length).toBeGreaterThan(0);
    }, 200000);
  }

  afterAll(async () => {
    await server.destroy();
  }, 100000);
});
