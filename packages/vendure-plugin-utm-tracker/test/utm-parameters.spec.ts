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
import { FirstClickAttribution, UTMTrackerPlugin } from '../src';

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
          { connectedAt: new Date('2025-01-01'), source: 'test-source' },
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
    expect(order.utmParameters[0].utmSource).toBe('test-source');
    expect(order.utmParameters[0].utmMedium).toBe(null);
    expect(order.utmParameters[0].utmCampaign).toBe(null);
    expect(order.utmParameters[0].utmTerm).toBe(null);
    expect(order.utmParameters[0].utmContent).toBe(null);
    expect(order.utmParameters[0].attributedPercentage).toBeNull();
    expect(order.utmParameters[0].createdAt).toBeDefined();
    expect(order.utmParameters[0].updatedAt).toBeDefined();
    expect(order.utmParameters[0].connectedAt).toBe('2025-01-01T00:00:00.000Z');
    expect(order.utmParameters[1].utmSource).toBe('test-source2');
    expect(order.utmParameters[1].utmMedium).toBe(null);
    expect(order.utmParameters[1].utmCampaign).toBe(null);
    expect(order.utmParameters[1].utmTerm).toBe(null);
    expect(order.utmParameters[1].utmContent).toBe(null);
    expect(order.utmParameters[1].attributedPercentage).toBeNull();
    expect(order.utmParameters[1].createdAt).toBeDefined();
    expect(order.utmParameters[1].updatedAt).toBeDefined();
    expect(order.utmParameters[1].connectedAt).toBe('2025-01-02T00:00:00.000Z');
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
          { source: 'test-source', connectedAt: new Date('2025-01-07') },
        ],
      }
    );
    await expect(addUTMParametersToOrder).toBe(true);
    await adminClient.asSuperAdmin();
    const { order } = await adminClient.query(GET_ORDER_WITH_UTM_PARAMETERS, {
      orderId: activeOrder.id,
    });
    expect(order.utmParameters.length).toBe(2);
    // Should now be moved to [1] because it has a newer connectedAt date
    expect(order.utmParameters[1].utmSource).toBe('test-source');
    expect(order.utmParameters[1].connectedAt).toBe('2025-01-07T00:00:00.000Z');
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
    expect(order.utmParameters[2].utmSource).toBe('test-source3');
    expect(order.utmParameters[2].utmMedium).toBe('test-medium3');
    expect(order.utmParameters[2].utmCampaign).toBe('test-campaign3');
    expect(order.utmParameters[2].utmTerm).toBe('test-term3');
    expect(order.utmParameters[2].utmContent).toBe('test-content3');
    expect(order.utmParameters[2].attributedPercentage).toBeNull();
    expect(order.utmParameters[2].connectedAt).toBe('2025-01-08T00:00:00.000Z');
  });

  it('Only keeps the 3 most recent UTM parameters after adding a fourth one', async () => {
    const { addUTMParametersToOrder } = await shopClient.query(
      ADD_UTM_PARAMETERS,
      {
        input: {
          source: 'test-source3',
        },
      }
    );
    await expect(addUTMParametersToOrder).toBe(true);
    await adminClient.asSuperAdmin();
    const { order } = await adminClient.query(GET_ORDER_WITH_UTM_PARAMETERS, {
      orderId: activeOrder.id,
    });
    expect(order.utmParameters.length).toBe(2);
    expect(order.utmParameters[0].utmSource).toBe('test-source2');
    expect(order.utmParameters[1].utmSource).toBe('test-source3');
  });

  // TODO Add one more UTm paramete with new Date(), because all previoius parameters are older that the configured 30 days

  it('Calculates attribution after order placement', async () => {
    await createSettledOrder(shopClient, 1, false); // false will make this function settle the current active order
    await adminClient.asSuperAdmin();
    // wait for async calculation to complete
    const utmParameters = await waitFor(async () => {
      const { order } = await adminClient.query(GET_ORDER_WITH_UTM_PARAMETERS, {
        orderId: activeOrder.id,
      });
      if (order.utmParameters[0].attributedPercentage === 1) {
        return order.utmParameters;
      }
    });
    // We use first click attribution model, so the oldest parameter should be attributed 100% (1)
    const oldestParameter = utmParameters[0];
    expect(oldestParameter.utmSource).toBe('test-source2');
    expect(oldestParameter.attributedPercentage).toBe(1);
    const mostRecentParameter = utmParameters[1];
    expect(mostRecentParameter.utmSource).toBe('test-source3');
    expect(mostRecentParameter.attributedPercentage).toBe(0);
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
        utmSource
        utmMedium
        utmCampaign
        utmTerm
        utmContent
        attributedPercentage
        createdAt
        updatedAt
        connectedAt
      }
    }
  }
`;
