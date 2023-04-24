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
import { SalesPerVariantPlugin } from '../src';
import { createSettledOrder } from '../../test/src/shop-utils';
import { GET_METRICS } from '../dist/ui/queries.graphql';
import {
  MetricSummary,
  MetricSummaryQuery,
} from '../dist/ui/generated/graphql';

describe('Metrics', () => {
  let shopClient: SimpleGraphQLClient;
  let adminClient: SimpleGraphQLClient;
  let server: TestServer;
  let metrics: MetricSummary[];

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const devConfig = mergeConfig(testConfig, {
      apiOptions: {
        port: 3050,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [SalesPerVariantPlugin],
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
    const { metricSummary } = await adminClient.query<MetricSummaryQuery>(
      GET_METRICS,
      { input: { interval: 'MONTHLY' } }
    );
    expect(metricSummary.length).toEqual(3);
    const aov = metricSummary.find((m) => m.code === 'aov')!;
    const cvr = metricSummary.find((m) => m.code === 'cvr')!;
    const nrOfOrders = metricSummary.find((m) => m.code === 'nr-of-orders')!;
    expect(aov.entries.length).toEqual(12);
    expect(cvr.entries.length).toEqual(12);
    expect(nrOfOrders.entries.length).toEqual(12);
    expect(aov.entries[11].value).toEqual(4921.4);
    expect(nrOfOrders.entries[11].value).toEqual(3);
  });

  it('Fetches WEEKLY metrics for all orders', async () => {
    await adminClient.asSuperAdmin();
    const { metricSummary } = await adminClient.query<MetricSummaryQuery>(
      GET_METRICS,
      { input: { interval: 'WEEKLY' } }
    );
    expect(metricSummary.length).toEqual(3);
    const aov = metricSummary.find((m) => m.code === 'aov')!;
    const cvr = metricSummary.find((m) => m.code === 'cvr')!;
    const nrOfOrders = metricSummary.find((m) => m.code === 'nr-of-orders')!;
    expect(aov.entries.length).toEqual(26);
    expect(cvr.entries.length).toEqual(26);
    expect(nrOfOrders.entries.length).toEqual(26);
    expect(aov.entries[25].value).toEqual(4921.4);
    expect(nrOfOrders.entries[25].value).toEqual(3);
  });

  it('Fetches WEEKLY metrics for variant with no order', async () => {
    await adminClient.asSuperAdmin();
    const { metricSummary } = await adminClient.query<MetricSummaryQuery>(
      GET_METRICS,
      { input: { interval: 'WEEKLY', variantId: 3 } }
    );
    // console.log(metricSummary);
    expect(metricSummary.length).toEqual(3);
    const aov = metricSummary.find((m) => m.code === 'aov')!;
    const cvr = metricSummary.find((m) => m.code === 'cvr')!;
    const nrOfOrders = metricSummary.find((m) => m.code === 'nr-of-orders')!;
    expect(aov.entries.length).toEqual(26);
    expect(cvr.entries.length).toEqual(26);
    expect(nrOfOrders.entries.length).toEqual(26);
    expect(aov.entries[25].value).toEqual(0);
    expect(nrOfOrders.entries[25].value).toEqual(0);
  });

  it('Fetches MONTHLY metrics for  variant with no order', async () => {
    await adminClient.asSuperAdmin();
    const { metricSummary } = await adminClient.query<MetricSummaryQuery>(
      GET_METRICS,
      { input: { interval: 'MONTHLY', variantId: 3 } }
    );
    expect(metricSummary.length).toEqual(3);
    const aov = metricSummary.find((m) => m.code === 'aov')!;
    const cvr = metricSummary.find((m) => m.code === 'cvr')!;
    const nrOfOrders = metricSummary.find((m) => m.code === 'nr-of-orders')!;
    expect(aov.entries.length).toEqual(12);
    expect(cvr.entries.length).toEqual(12);
    expect(nrOfOrders.entries.length).toEqual(12);
    expect(aov.entries[11].value).toEqual(0);
    expect(nrOfOrders.entries[11].value).toEqual(0);
  });

  it('Fetches WEEKLY metrics for variant with id 1', async () => {
    await adminClient.asSuperAdmin();
    const { metricSummary } = await adminClient.query<MetricSummaryQuery>(
      GET_METRICS,
      { input: { interval: 'WEEKLY', variantId: 1 } }
    );
    expect(metricSummary.length).toEqual(3);
    const aov = metricSummary.find((m) => m.code === 'aov')!;
    const cvr = metricSummary.find((m) => m.code === 'cvr')!;
    const nrOfOrders = metricSummary.find((m) => m.code === 'nr-of-orders')!;
    expect(aov.entries.length).toEqual(26);
    expect(cvr.entries.length).toEqual(26);
    expect(nrOfOrders.entries.length).toEqual(26);
    expect(aov.entries[25].value).toEqual(4921.4);
    expect(nrOfOrders.entries[25].value).toEqual(3);
  });

  it('Fetches MONTHLY metrics for  variant with id 1', async () => {
    await adminClient.asSuperAdmin();
    const { metricSummary } = await adminClient.query<MetricSummaryQuery>(
      GET_METRICS,
      { input: { interval: 'MONTHLY', variantId: 1 } }
    );
    expect(metricSummary.length).toEqual(3);
    const aov = metricSummary.find((m) => m.code === 'aov')!;
    const cvr = metricSummary.find((m) => m.code === 'cvr')!;
    const nrOfOrders = metricSummary.find((m) => m.code === 'nr-of-orders')!;
    expect(aov.entries.length).toEqual(12);
    expect(cvr.entries.length).toEqual(12);
    expect(nrOfOrders.entries.length).toEqual(12);
    expect(aov.entries[11].value).toEqual(4921.4);
    expect(nrOfOrders.entries[11].value).toEqual(3);
  });
});
