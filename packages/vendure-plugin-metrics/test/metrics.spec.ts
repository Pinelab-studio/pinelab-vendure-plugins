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
  AdvancedMetricSummaryQuery,
  MetricsPlugin,
} from '../src';
import { GET_METRICS } from '../src/ui/queries.graphql';
import { expect, describe, beforeAll, afterAll, it, vi, test } from 'vitest';
import { createSettledOrder } from '../../test/src/shop-utils';

describe('Metrics', () => {
  //FIX ME
  let shopClient: any;
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
    await createSettledOrder(shopClient, 1);
    await createSettledOrder(shopClient, 1);
    await createSettledOrder(shopClient, 1);
  });

  it('Fails to fetch metrics when unauthenticated', async () => {
    const promise = adminClient.query(GET_METRICS, {
      input: { interval: 'MONTHLY' },
    });
    await expect(promise).rejects.toThrow('authorized');
  });

  it('Fetches MONTHLY metrics for all orders', async () => {
    await adminClient.asSuperAdmin();
    const { advancedMetricSummary } =
      await adminClient.query<AdvancedMetricSummaryQuery>(GET_METRICS, {
        input: { interval: 'MONTHLY' },
      });
    expect(advancedMetricSummary.length).toEqual(3);
    const aov = advancedMetricSummary.find((m) => m.code === 'aov')!;
    const nrOfOrders = advancedMetricSummary.find(
      (m) => m.code === 'nr-of-orders'
    )!;
    expect(aov.entries.length).toEqual(12);
    expect(nrOfOrders.entries.length).toEqual(12);
    expect(aov.entries[11].value).toEqual(4921.4);
    expect(nrOfOrders.entries[11].value).toEqual(3);
  });

  it('Fetches WEEKLY metrics for all orders', async () => {
    await adminClient.asSuperAdmin();
    const { advancedMetricSummary } =
      await adminClient.query<AdvancedMetricSummaryQuery>(GET_METRICS, {
        input: { interval: 'WEEKLY' },
      });
    expect(advancedMetricSummary.length).toEqual(3);
    const aov = advancedMetricSummary.find((m) => m.code === 'aov')!;
    const nrOfOrders = advancedMetricSummary.find(
      (m) => m.code === 'nr-of-orders'
    )!;
    expect(aov.entries.length).toEqual(26);
    expect(nrOfOrders.entries.length).toEqual(26);
    expect(aov.entries[25].value).toEqual(4921.4);
    expect(nrOfOrders.entries[25].value).toEqual(3);
  });

  it('Fetches WEEKLY metrics for variant with no order', async () => {
    await adminClient.asSuperAdmin();
    const { advancedMetricSummary } =
      await adminClient.query<AdvancedMetricSummaryQuery>(GET_METRICS, {
        input: { interval: 'WEEKLY', variantIds: [3] },
      });
    expect(advancedMetricSummary.length).toEqual(3);
    const aov = advancedMetricSummary.find((m) => m.code === 'aov')!;
    const nrOfOrders = advancedMetricSummary.find(
      (m) => m.code === 'nr-of-orders'
    )!;
    const nrOfItemsSold = advancedMetricSummary.find(
      (m) => m.code === 'nr-of-items-sold'
    )!;
    expect(aov.entries.length).toEqual(26);
    expect(nrOfItemsSold.entries.length).toEqual(26);
    expect(aov.entries[25].value).toEqual(0);
    expect(nrOfItemsSold.entries[25].value).toEqual(0);
  });

  it('Fetches MONTHLY metrics for  variant with no order', async () => {
    await adminClient.asSuperAdmin();
    const { advancedMetricSummary } =
      await adminClient.query<AdvancedMetricSummaryQuery>(GET_METRICS, {
        input: { interval: 'MONTHLY', variantIds: [3] },
      });
    expect(advancedMetricSummary.length).toEqual(3);
    const aov = advancedMetricSummary.find((m) => m.code === 'aov')!;
    const nrOfOrders = advancedMetricSummary.find(
      (m) => m.code === 'nr-of-orders'
    )!;
    const nrOfItemsSold = advancedMetricSummary.find(
      (m) => m.code === 'nr-of-items-sold'
    )!;
    expect(nrOfOrders.entries.length).toEqual(12);
    expect(nrOfOrders.entries[11].value).toEqual(0);
    expect(aov.entries.length).toEqual(12);
    expect(nrOfItemsSold.entries.length).toEqual(12);
    expect(aov.entries[11].value).toEqual(0);
    expect(nrOfItemsSold.entries[11].value).toEqual(0);
  });

  it('Fetches WEEKLY metrics for variant with id 1', async () => {
    await adminClient.asSuperAdmin();
    const { advancedMetricSummary } =
      await adminClient.query<AdvancedMetricSummaryQuery>(GET_METRICS, {
        input: { interval: 'WEEKLY', variantIds: [1] },
      });
    expect(advancedMetricSummary.length).toEqual(3);
    const aov = advancedMetricSummary.find((m) => m.code === 'aov')!;
    const nrOfOrders = advancedMetricSummary.find(
      (m) => m.code === 'nr-of-orders'
    )!;
    const nrOfItemsSold = advancedMetricSummary.find(
      (m) => m.code === 'nr-of-items-sold'
    )!;
    expect(nrOfOrders.entries.length).toEqual(26);
    expect(nrOfOrders.entries[11].value).toEqual(0);
    expect(aov.entries.length).toEqual(26);
    expect(nrOfItemsSold.entries.length).toEqual(26);
    expect(aov.entries[25].value).toEqual(4921.4);
    expect(nrOfItemsSold.entries[25].value).toEqual(3);
  });

  it('Fetches MONTHLY metrics for  variant with id 1', async () => {
    await adminClient.asSuperAdmin();
    const { advancedMetricSummary } =
      await adminClient.query<AdvancedMetricSummaryQuery>(GET_METRICS, {
        input: { interval: 'MONTHLY', variantIds: [1] },
      });
    expect(advancedMetricSummary.length).toEqual(3);
    const aov = advancedMetricSummary.find((m) => m.code === 'aov')!;
    const nrOfOrders = advancedMetricSummary.find(
      (m) => m.code === 'nr-of-orders'
    )!;
    const nrOfItemsSold = advancedMetricSummary.find(
      (m) => m.code === 'nr-of-items-sold'
    )!;
    expect(nrOfOrders.entries.length).toEqual(12);
    expect(nrOfOrders.entries[11].value).toEqual(3);
    expect(aov.entries.length).toEqual(12);
    expect(nrOfItemsSold.entries.length).toEqual(12);
    expect(aov.entries[11].value).toEqual(4921.4);
    expect(nrOfItemsSold.entries[11].value).toEqual(3);
  });
});
