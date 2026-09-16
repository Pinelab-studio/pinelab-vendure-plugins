import { DefaultLogger, LogLevel, mergeConfig, Order } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { addItem, createSettledOrder } from '../../test/src/shop-utils';
import { waitFor } from '../../test/src/test-helpers';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import {
  FirstClickAttribution,
  NoopAttribution,
  UtmOrderParameter,
  UTMTrackerPlugin,
  UTMTrackerService,
} from '../src';

describe('UTM parameters plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        UTMTrackerPlugin.init({
          attributionModel: new FirstClickAttribution(),
          maxParametersPerOrder: 3,
          maxAttributionAgeInDays: 30,
          getCampaignDisplayName: (ctx, utmParameters) => {
            return utmParameters.source + '_customSuffix'; // Testing custom display name
          },
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
    });
    serverStarted = true;
  }, 60000);

  afterAll(async () => {
    await server.destroy();
  });

  it('Should start successfully', async () => {
    await expect(serverStarted).toBe(true);
  });

  it('Fails when no active order', async () => {
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    const addUTMParametersToOrderPromise = shopClient.query(
      ADD_UTM_PARAMETERS,
      {
        inputs: [
          { connectedAt: new Date('2025-01-01'), source: 'test-source' },
        ],
      }
    );
    await expect(addUTMParametersToOrderPromise).rejects.toThrow(
      /No active order found|error\.no-active-session/
    );
  });

  let activeOrder: Order;

  it('Adds UTM parameters to order', async () => {
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    activeOrder = await addItem(shopClient, 'T_1', 1);
    const { addUTMParametersToOrder } = await shopClient.query(
      ADD_UTM_PARAMETERS,
      {
        inputs: [
          {
            connectedAt: new Date('2025-01-01'),
            source: 'test-source1',
            clid: 'combined-client-id',
          },
          {
            connectedAt: new Date('2025-01-02'),
            clid: 'standalone-client-id',
          },
        ],
      }
    );
    expect(addUTMParametersToOrder).toBe(true);
    await adminClient.asSuperAdmin();
    const { order } = await adminClient.query(GET_ORDER_WITH_UTM_PARAMETERS, {
      orderId: activeOrder.id,
    });
    expect(order.utmParameters.length).toBe(2);
    expect(order.utmParameters[0].utmSource).toBe(null);
    expect(order.utmParameters[0].utmMedium).toBe(null);
    expect(order.utmParameters[0].utmCampaign).toBe(null);
    expect(order.utmParameters[0].utmTerm).toBe(null);
    expect(order.utmParameters[0].utmContent).toBe(null);
    expect(order.utmParameters[0].clid).toBe('standalone-client-id');
    expect(order.utmParameters[0].attributedPercentage).toBeNull();
    expect(order.utmParameters[0].createdAt).toBeDefined();
    expect(order.utmParameters[0].updatedAt).toBeDefined();
    expect(order.utmParameters[0].connectedAt).toBe('2025-01-02T00:00:00.000Z');
    expect(order.utmParameters[1].utmSource).toBe('test-source1');
    expect(order.utmParameters[1].utmMedium).toBe(null);
    expect(order.utmParameters[1].utmCampaign).toBe(null);
    expect(order.utmParameters[1].utmTerm).toBe(null);
    expect(order.utmParameters[1].utmContent).toBe(null);
    expect(order.utmParameters[1].clid).toBe('combined-client-id');
    expect(order.utmParameters[1].attributedPercentage).toBeNull();
    expect(order.utmParameters[1].createdAt).toBeDefined();
    expect(order.utmParameters[1].updatedAt).toBeDefined();
    expect(order.utmParameters[1].connectedAt).toBe('2025-01-01T00:00:00.000Z');
  });

  it('Adds the same UTM parameter to order again with a newer connectedAt date', async () => {
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    const { addUTMParametersToOrder } = await shopClient.query(
      ADD_UTM_PARAMETERS,
      {
        inputs: [
          {
            source: 'test-source1',
            clid: 'combined-client-id',
            connectedAt: new Date('2025-01-07'),
          },
        ],
      }
    );
    await expect(addUTMParametersToOrder).toBe(true);
    await adminClient.asSuperAdmin();
    const { order } = await adminClient.query(GET_ORDER_WITH_UTM_PARAMETERS, {
      orderId: activeOrder.id,
    });
    expect(order.utmParameters.length).toBe(2);
    expect(order.utmParameters[0].utmSource).toBe('test-source1');
    expect(order.utmParameters[0].campaignDisplayName).toBe(
      'test-source1_customSuffix'
    );
    expect(order.utmParameters[0].connectedAt).toBe('2025-01-07T00:00:00.000Z');
    expect(order.utmParameters[0].clid).toBe('combined-client-id');
  });

  it('Adds another UTM parameter (#3) to order', async () => {
    const { addUTMParametersToOrder } = await shopClient.query(
      ADD_UTM_PARAMETERS,
      {
        inputs: [
          {
            connectedAt: new Date('2025-01-08'),
            source: 'test-source3',
            medium: 'test-medium3',
            campaign: 'test-campaign3',
            term: 'test-term3',
            content: 'test-content3',
            clid: 'combined-client-id-3',
          },
        ],
      }
    );
    await expect(addUTMParametersToOrder).toBe(true);
    await adminClient.asSuperAdmin();
    const { order } = await adminClient.query(GET_ORDER_WITH_UTM_PARAMETERS, {
      orderId: activeOrder.id,
    });
    expect(order.utmParameters.length).toBe(3);
    expect(order.utmParameters[0].utmSource).toBe('test-source3');
    expect(order.utmParameters[0].utmMedium).toBe('test-medium3');
    expect(order.utmParameters[0].utmCampaign).toBe('test-campaign3');
    expect(order.utmParameters[0].utmTerm).toBe('test-term3');
    expect(order.utmParameters[0].utmContent).toBe('test-content3');
    expect(order.utmParameters[0].clid).toBe('combined-client-id-3');
    expect(order.utmParameters[0].attributedPercentage).toBeNull();
    expect(order.utmParameters[0].connectedAt).toBe('2025-01-08T00:00:00.000Z');
  });

  it('Only keeps the 3 most recent UTM parameters after adding a fourth one', async () => {
    const { addUTMParametersToOrder } = await shopClient.query(
      ADD_UTM_PARAMETERS,
      {
        inputs: [
          {
            source: 'test-source4',
            connectedAt: new Date('2025-01-09'),
          },
        ],
      }
    );
    await expect(addUTMParametersToOrder).toBe(true);
    await adminClient.asSuperAdmin();
    const { order } = await adminClient.query(GET_ORDER_WITH_UTM_PARAMETERS, {
      orderId: activeOrder.id,
    });
    expect(order.utmParameters.length).toBe(3);
    expect(order.utmParameters[0].utmSource).toBe('test-source4');
    expect(order.utmParameters[1].utmSource).toBe('test-source3');
    expect(order.utmParameters[2].utmSource).toBe('test-source1');
  });

  it('Adding 5 new UTM parameters will only save the 3 most recent ones', async () => {
    const { addUTMParametersToOrder } = await shopClient.query(
      ADD_UTM_PARAMETERS,
      {
        inputs: [
          {
            source: 'recent1',
            connectedAt: new Date(Date.now() - 10000),
          },
          {
            source: 'recent2',
            connectedAt: new Date(Date.now() - 3), // Oldest (last click)
          },
          {
            source: 'recent3',
            connectedAt: new Date(Date.now() - 2), // Middle
          },
          {
            source: 'recent4',
            connectedAt: new Date(Date.now() - 10000),
          },
          {
            source: 'recent5',
            connectedAt: new Date(Date.now() - 1), // Newest (first click)
          },
        ],
      }
    );
    await expect(addUTMParametersToOrder).toBe(true);
    await adminClient.asSuperAdmin();
    const { order } = await adminClient.query(GET_ORDER_WITH_UTM_PARAMETERS, {
      orderId: activeOrder.id,
    });
    expect(order.utmParameters.length).toBe(3);
    expect(order.utmParameters[0].utmSource).toBe('recent5'); // Last click (newest)
    expect(order.utmParameters[1].utmSource).toBe('recent3'); // Middle
    expect(order.utmParameters[2].utmSource).toBe('recent2'); // First click (oldest)
  });

  it('Calculates attribution after order placement', async () => {
    await createSettledOrder(shopClient, 1, false); // false will make this function settle the current active order
    await adminClient.asSuperAdmin();
    // wait for async calculation to complete
    const utmParameters = await waitFor(async () => {
      const { order } = await adminClient.query(GET_ORDER_WITH_UTM_PARAMETERS, {
        orderId: activeOrder.id,
      });
      if (
        order.utmParameters.find(
          (p: UtmOrderParameter) => p.attributedPercentage === 1
        )
      ) {
        // Return as soon as a parameter is attributed 100%
        return order.utmParameters;
      }
    });
    // We use first click attribution model, so the oldest parameter should be attributed 100% (1)
    const recent2 = utmParameters.find(
      (p: UtmOrderParameter) => p.utmSource === 'recent2'
    );
    const recent3 = utmParameters.find(
      (p: UtmOrderParameter) => p.utmSource === 'recent3'
    );
    const recent5 = utmParameters.find(
      (p: UtmOrderParameter) => p.utmSource === 'recent5'
    );
    expect(recent2.attributedPercentage).toBe(1); // 1, because it's the first click
    expect(recent2.attributedValue).toBe(540100); // 100, because it's the first click
    expect(recent3.attributedPercentage).toBe(0); // 0, because it's not the first click
    expect(recent3.attributedValue).toBe(null); // 0, because it's not the first click
    expect(recent5.attributedPercentage).toBe(0); // 0, because it's not the first click
    expect(recent5.attributedValue).toBe(null); // 0, because it's not the first click
  });

  it('Excludes parameters older than the attribution window', async () => {
    const ageTestOrder = await addItem(shopClient, 'T_1', 1);
    await shopClient.query(ADD_UTM_PARAMETERS, {
      inputs: [
        {
          connectedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
          source: 'too-old-for-attribution',
        },
        {
          connectedAt: new Date(),
          source: 'eligible-for-attribution',
        },
      ],
    });

    await createSettledOrder(shopClient, 1, false);
    const utmParameters = await waitFor(async () => {
      const { order } = await adminClient.query(GET_ORDER_WITH_UTM_PARAMETERS, {
        orderId: ageTestOrder.id,
      });
      if (
        order.utmParameters.find(
          (p: UtmOrderParameter) =>
            p.utmSource === 'eligible-for-attribution' &&
            p.attributedPercentage === 1
        )
      ) {
        return order.utmParameters;
      }
    });

    expect(
      utmParameters.find(
        (p: UtmOrderParameter) => p.utmSource === 'too-old-for-attribution'
      )?.attributedPercentage
    ).toBeNull();
    expect(
      utmParameters.find(
        (p: UtmOrderParameter) => p.utmSource === 'eligible-for-attribution'
      )?.attributedPercentage
    ).toBe(1);
  });
});

const ADD_UTM_PARAMETERS = gql`
  mutation addUTMParametersToOrder($inputs: [UTMParameterInput!]!) {
    addUTMParametersToOrder(inputs: $inputs)
  }
`;

const GET_ORDER_WITH_UTM_PARAMETERS = gql`
  query getOrderWithUTMParameters($orderId: ID!) {
    order(id: $orderId) {
      utmParameters {
        id
        campaignDisplayName
        utmSource
        utmMedium
        utmCampaign
        utmTerm
        utmContent
        clid
        attributedPercentage
        attributedValue
        createdAt
        updatedAt
        connectedAt
      }
    }
  }
`;

describe('UTM parameters plugin with no-op attribution', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data_noop__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        UTMTrackerPlugin.init({
          attributionModel: new NoopAttribution(),
          maxParametersPerOrder: 5,
          maxAttributionAgeInDays: 30,
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
    });
  }, 60000);

  afterAll(async () => {
    await server.destroy();
  });

  it('Keeps standalone and combined client IDs unattributed after placement', async () => {
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    const activeOrder = await addItem(shopClient, 'T_1', 1);
    await shopClient.query(ADD_UTM_PARAMETERS, {
      inputs: [
        {
          connectedAt: new Date(),
          clid: 'standalone-noop-client',
        },
        {
          connectedAt: new Date(),
          source: 'noop-source',
          clid: '  combined-noop-client  ',
        },
        {
          connectedAt: new Date(),
          source: 'noop-source',
          clid: 'distinct-noop-client',
        },
        {
          connectedAt: new Date(),
          clid: '   ',
        },
      ],
    });
    await shopClient.query(ADD_UTM_PARAMETERS, {
      inputs: [
        {
          connectedAt: new Date(),
          source: 'noop-source',
          clid: 'combined-noop-client',
        },
      ],
    });

    const service = server.app.get(UTMTrackerService);
    const calculateAttribution = vi.spyOn(service, 'calculateAttribution');
    await createSettledOrder(shopClient, 1, false);
    await waitFor(async () => {
      const invocation = calculateAttribution.mock.results[0];
      if (invocation?.type === 'return') {
        await invocation.value;
        return true;
      }
    });

    await adminClient.asSuperAdmin();
    const { order } = await adminClient.query(GET_ORDER_WITH_UTM_PARAMETERS, {
      orderId: activeOrder.id,
    });
    expect(order.utmParameters).toHaveLength(3);
    expect(order.utmParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clid: 'standalone-noop-client',
          utmSource: null,
          attributedPercentage: null,
          attributedValue: null,
        }),
        expect.objectContaining({
          clid: 'combined-noop-client',
          utmSource: 'noop-source',
          attributedPercentage: null,
          attributedValue: null,
        }),
        expect.objectContaining({
          clid: 'distinct-noop-client',
          utmSource: 'noop-source',
          attributedPercentage: null,
          attributedValue: null,
        }),
      ])
    );
  });
});
