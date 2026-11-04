import { Order, TransactionalConnection, VendureConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  type SimpleGraphQLClient,
  SqljsInitializer,
  type TestServer,
} from '@vendure/testing';
import { subYears } from 'date-fns';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import {
  type MetricChart,
  type MetricChartsQuery,
  MetricResult,
  MetricsService,
} from '../src';
import { GET_METRIC_CHARTS, GET_METRIC_CODE_ENUM } from './queries.graphql';
import { config, testMetricState } from './vendure-config';

describe('Metrics', () => {
  let shopClient: SimpleGraphQLClient;
  let adminClient: SimpleGraphQLClient;
  let server: TestServer;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const env = createTestEnvironment(config as Required<VendureConfig>);
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

  it('Creates 2 orders today, 1 cancelled order today, 1 order a year ago and a second channel', async () => {
    // Each order is 1x T_1 and 2x T_2: 3 units, with a total of 4102.00 excl. tax
    await createSettledOrder(shopClient, 1);
    await createSettledOrder(shopClient, 1);
    const orderRepository = server.app
      .get(TransactionalConnection)
      .rawConnection.getRepository(Order);
    // Should not be included in any metric
    const cancelledOrder = await createSettledOrder(shopClient, 1);
    await orderRepository.update(
      { code: cancelledOrder.code },
      { state: 'Cancelled' },
    );
    const lastYearOrder = await createSettledOrder(shopClient, 1);
    await orderRepository.update(
      { code: lastYearOrder.code },
      { orderPlacedAt: subYears(new Date(), 1) },
    );
    await adminClient.asSuperAdmin();
    const { createChannel } = await adminClient.query(CREATE_CHANNEL, {
      input: {
        code: 'second-channel',
        token: 'second-channel-token',
        defaultLanguageCode: 'en',
        defaultCurrencyCode: 'USD',
        pricesIncludeTax: false,
        defaultShippingZoneId: 1,
        defaultTaxZoneId: 1,
      },
    });
    expect(createChannel.id).toBeDefined();
  });

  it('Fails to fetch charts when unauthenticated', async () => {
    await adminClient.asAnonymousUser();
    await expect(
      adminClient.query(GET_METRIC_CHARTS, { code: 'revenue' }),
    ).rejects.toThrow('authorized');
  });

  it('Returns no charts before the metrics have been generated', async () => {
    await adminClient.asSuperAdmin();
    const charts = await getCharts('revenue');
    expect(charts).toEqual([]);
  });

  it('Exposes the configured metric codes as MetricCode enum for the dashboard', async () => {
    const { __type } = await adminClient.query(GET_METRIC_CODE_ENUM);
    expect(__type.enumValues.map((v: { name: string }) => v.name)).toEqual([
      'revenue',
      'aov',
      'units_sold',
      'test_sequential',
      'test_failing',
    ]);
  });

  it('Calculates metrics sequentially and stores a result per metric, variation and channel', async () => {
    await server.app.get(MetricsService).generateAllCharts();
    // 2 variations of the sequential metric + the failing metric in 2 channels
    expect(testMetricState.calls).toBe(4);
    expect(testMetricState.maxInFlight).toBe(1);
    const results = await getStoredResults();
    const countPerCode = (code: string) =>
      results.filter((r) => r.code === code).length;
    // 3 variations in 2 channels
    expect(countPerCode('revenue')).toBe(6);
    expect(countPerCode('aov')).toBe(6);
    expect(countPerCode('units_sold')).toBe(6);
    // 2 variations, channel independent
    expect(countPerCode('test_sequential')).toBe(2);
    expect(
      results
        .filter((r) => r.code === 'test_sequential')
        .every((r) => r.channelId === null),
    ).toBe(true);
    // No variations, 2 channels
    expect(countPerCode('test_failing')).toBe(2);
  });

  it('Keeps the previous result of a failing metric and still runs the others', async () => {
    testMetricState.failing = true;
    testMetricState.run = 2;
    await server.app.get(MetricsService).generateAllCharts();
    const failing = await getCharts('test_failing');
    expect(failing.map((c) => c.title)).toEqual(['Failing metric run 1']);
    const sequential = await getCharts('test_sequential');
    expect(sequential.map((c) => c.title)).toEqual([
      'Variation A run 2',
      'Variation B run 2',
    ]);
  });

  it('Returns stored charts without calculating metrics', async () => {
    testMetricState.calls = 0;
    const charts = await getCharts('test_sequential');
    expect(charts.map((c) => c.variation)).toEqual([
      'Variation A',
      'Variation B',
    ]);
    expect(testMetricState.calls).toBe(0);
  });

  it('Shows channel independent charts in every channel', async () => {
    adminClient.setChannelToken('second-channel-token');
    const charts = await getCharts('test_sequential');
    adminClient.setChannelToken('e2e-default-channel');
    expect(charts).toHaveLength(2);
  });

  it('Hides charts of metrics that are not configured', async () => {
    const charts = await getCharts('some_removed_metric');
    expect(charts).toEqual([]);
  });

  it('Calculates revenue for today and the same day last year', async () => {
    const charts = await getCharts('revenue');
    expect(charts.map((c) => c.variation)).toEqual([
      'Past 7 days',
      'Past 30 days',
      'Past 6 months',
    ]);
    const past7Days = charts[0];
    expect(past7Days.title).toBe('Revenue (excl. tax)');
    expect(past7Days.type).toBe('line');
    expect(past7Days.valueFormat).toBe('currency');
    expect(past7Days.data.labels).toHaveLength(7);
    const [current, previousYear] = past7Days.data.datasets;
    expect(current.data).toEqual([0, 0, 0, 0, 0, 0, 820400]);
    expect(previousYear.data).toEqual([0, 0, 0, 0, 0, 0, 410200]);
    const past6Months = charts[2];
    expect(past6Months.data.labels).toHaveLength(6);
    expect(past6Months.data.datasets[0].data[5]).toBe(820400);
    expect(past6Months.data.datasets[1].data[5]).toBe(410200);
  });

  it('Calculates average order value and units sold', async () => {
    const [aovPast30Days] = (await getCharts('aov')).filter(
      (c) => c.variation === 'Past 30 days',
    );
    expect(aovPast30Days.title).toBe('Average order value (excl. tax)');
    expect(aovPast30Days.data.datasets[0].data[29]).toBe(410200);
    expect(aovPast30Days.data.datasets[1].data[29]).toBe(410200);
    const [unitsSoldPast7Days] = await getCharts('units_sold');
    expect(unitsSoldPast7Days.valueFormat).toBe('number');
    expect(unitsSoldPast7Days.data.datasets[0].data[6]).toBe(6);
    expect(unitsSoldPast7Days.data.datasets[1].data[6]).toBe(3);
  });

  it('Calculates charts per channel', async () => {
    adminClient.setChannelToken('second-channel-token');
    const [revenue] = await getCharts('revenue');
    adminClient.setChannelToken('e2e-default-channel');
    // No orders were placed in the second channel
    expect(revenue.data.datasets[0].data).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  afterAll(async () => {
    await server.destroy();
  }, 100000);

  /**
   * Get the charts of a metric via the Admin API
   */
  async function getCharts(code: string) {
    const { metricCharts } = await adminClient.query<MetricChartsQuery>(
      GET_METRIC_CHARTS,
      { code },
    );
    return metricCharts as Array<
      MetricChartsQuery['metricCharts'][number] & {
        data: Required<MetricChart['data']> & {
          datasets: Array<{ data: number[] }>;
        };
      }
    >;
  }

  async function getStoredResults() {
    return await server.app
      .get(TransactionalConnection)
      .rawConnection.getRepository(MetricResult)
      .find();
  }
});

const CREATE_CHANNEL = gql`
  mutation createChannel($input: CreateChannelInput!) {
    createChannel(input: $input) {
      ... on Channel {
        id
      }
    }
  }
`;
