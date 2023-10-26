import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { initialData } from '../../test/src/initial-data';
import {
  AdvancedMetricSummary,
  MetricsPlugin,
  AdvancedMetricSummariesQuery,
} from '../src';
import { GET_METRICS } from '../src/ui/queries.graphql';
import { expect, describe, beforeAll, afterAll, it, vi, test } from 'vitest';
import { createSettledOrder } from '../../test/src/shop-utils';
import path from 'path';
import * as fs from 'fs';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import getFilesInAdminUiFolder from '../../util/src/compile-admin-ui.util';

describe('Metrics', () => {
  let shopClient: SimpleGraphQLClient;
  let adminClient: SimpleGraphQLClient;
  let server: TestServer;
  let metrics: AdvancedMetricSummary[];

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

  afterAll(async () => {
    await server.destroy();
  });

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

  it('Fetches metrics for past 13 months', async () => {
    await adminClient.asSuperAdmin();
    const { advancedMetricSummaries } =
      await adminClient.query<AdvancedMetricSummariesQuery>(GET_METRICS);
    const averageorderValue = advancedMetricSummaries.find(
      (m) => m.code === 'aov'
    )!;
    const salesPerProduct = advancedMetricSummaries.find(
      (m) => m.code === 'sales-per-product'
    )!;
    expect(advancedMetricSummaries.length).toEqual(2);
    expect(averageorderValue.series[0].values.length).toEqual(13);
    expect(averageorderValue.labels.length).toEqual(13);
    expect(salesPerProduct.series[0].values.length).toEqual(13);
    expect(salesPerProduct.labels.length).toEqual(13);
  });

  it('Fetches metrics for specific variant', async () => {
    await adminClient.asSuperAdmin();
    const { advancedMetricSummaries } =
      await adminClient.query<AdvancedMetricSummariesQuery>(GET_METRICS, {
        input: { variantIds: [1, 2] },
      });
    const averageorderValue = advancedMetricSummaries.find(
      (m) => m.code === 'aov'
    )!;
    const salesPerProduct = advancedMetricSummaries.find(
      (m) => m.code === 'sales-per-product'
    )!;
    expect(advancedMetricSummaries.length).toEqual(2);
    expect(advancedMetricSummaries.length).toEqual(2);
    expect(averageorderValue.series[0].values.length).toEqual(13);
    expect(averageorderValue.labels.length).toEqual(13);
    // For sales per product we expect 2 series: one for each variant
    expect(salesPerProduct.series[0].values.length).toEqual(13);
    expect(salesPerProduct.series[1].values.length).toEqual(13);
    expect(salesPerProduct.labels.length).toEqual(13);
    // Expect the first series (variant 1), to have 3 sales in last month
    expect(salesPerProduct.series[0].values[12]).toEqual(3);
    // Expect the first series (variant 2), to have 6 sales in last month
    expect(salesPerProduct.series[1].values[12]).toEqual(6);
  });

  it('Should compile admin', async () => {
    const files = await getFilesInAdminUiFolder(__dirname, MetricsPlugin.ui);
    expect(files?.length).toBeGreaterThan(0);
  }, 200000);

  afterAll(async () => {
    await server.destroy();
  });
});
