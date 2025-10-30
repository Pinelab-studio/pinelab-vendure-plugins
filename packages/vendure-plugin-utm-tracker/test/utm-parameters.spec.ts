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
import { beforeAll, describe, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { addItem, createSettledOrder } from '../../test/src/shop-utils';
import { waitFor } from '../../test/src/test-helpers';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import {
  FirstClickAttribution,
  UtmOrderParameter,
  UTMTrackerPlugin,
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
      'No active order found'
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
          { connectedAt: new Date('2025-01-01'), source: 'test-source1' },
          { connectedAt: new Date('2025-01-02'), source: 'test-source2' },
        ],
      }
    );
    expect(addUTMParametersToOrder).toBe(true);
    await adminClient.asSuperAdmin();
    const { order } = await adminClient.query(GET_ORDER_WITH_UTM_PARAMETERS, {
      orderId: activeOrder.id,
    });
    expect(order.utmParameters.length).toBe(2);
    expect(order.utmParameters[0].utmSource).toBe('test-source2');
    expect(order.utmParameters[0].utmMedium).toBe(null);
    expect(order.utmParameters[0].utmCampaign).toBe(null);
    expect(order.utmParameters[0].utmTerm).toBe(null);
    expect(order.utmParameters[0].utmContent).toBe(null);
    expect(order.utmParameters[0].attributedPercentage).toBeNull();
    expect(order.utmParameters[0].createdAt).toBeDefined();
    expect(order.utmParameters[0].updatedAt).toBeDefined();
    expect(order.utmParameters[0].connectedAt).toBe('2025-01-02T00:00:00.000Z');
    expect(order.utmParameters[1].utmSource).toBe('test-source1');
    expect(order.utmParameters[1].utmMedium).toBe(null);
    expect(order.utmParameters[1].utmCampaign).toBe(null);
    expect(order.utmParameters[1].utmTerm).toBe(null);
    expect(order.utmParameters[1].utmContent).toBe(null);
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
          { source: 'test-source1', connectedAt: new Date('2025-01-07') },
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
    expect(order.utmParameters[0].connectedAt).toBe('2025-01-07T00:00:00.000Z');
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
            connectedAt: new Date(Date.now() - 3), // Last (oldest)
          },
          {
            source: 'recent3',
            connectedAt: new Date(Date.now() - 2), // Second
          },
          {
            source: 'recent4',
            connectedAt: new Date(Date.now() - 10000),
          },
          {
            source: 'recent5',
            connectedAt: new Date(Date.now() - 1), // First (oldest)
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
    expect(order.utmParameters[0].utmSource).toBe('recent5');
    expect(order.utmParameters[1].utmSource).toBe('recent3');
    expect(order.utmParameters[2].utmSource).toBe('recent2');
  });

  it('Calculates attribution after order placement', async () => {
    await createSettledOrder(shopClient, 1, false); // false will make this function settle the current active order
    await adminClient.asSuperAdmin();
    // wait for async calculation to complete
    const utmParameters = await waitFor(async () => {
      const { order } = await adminClient.query(GET_ORDER_WITH_UTM_PARAMETERS, {
        orderId: activeOrder.id,
      });
      if (order.utmParameters[0].attributedPercentage === 1) {
        // [] is recent2, the first click
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
    expect(recent5.attributedPercentage).toBe(1); // 1, because it's the first click
    expect(recent5.attributedValue).toBe(540100); // 100, because it's the first click
    expect(recent3.attributedPercentage).toBe(0); // 0, because it's not the first click
    expect(recent3.attributedValue).toBe(null); // 0, because it's not the first click
    expect(recent2.attributedPercentage).toBe(0); // 0, because it's not the first click
    expect(recent2.attributedValue).toBe(null); // 0, because it's not the first click
  });

  if (process.env.TEST_ADMIN_UI) {
    it('Should compile admin UI extension', async () => {
      // Dynamically import the utility for file checking
      const getFilesInAdminUiFolder = (
        await import('../../test/src/compile-admin-ui.util')
      ).default;
      // Import the plugin
      const { UTMTrackerPlugin } = await import('../src');
      const files = await getFilesInAdminUiFolder(
        __dirname,
        UTMTrackerPlugin.ui
      );
      expect(files?.length).toBeGreaterThan(0);
    }, 200000);
  }
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
        utmSource
        utmMedium
        utmCampaign
        utmTerm
        utmContent
        attributedPercentage
        attributedValue
        createdAt
        updatedAt
        connectedAt
      }
    }
  }
`;
