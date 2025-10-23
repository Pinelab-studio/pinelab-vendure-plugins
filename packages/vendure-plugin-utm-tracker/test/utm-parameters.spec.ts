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
          maxParametersPerOrder: 2,
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
      { input: { source: 'test-source' } }
    );
    await expect(addUTMParametersToOrderPromise).rejects.toThrow(
      'No active order found'
    );
  });

  let activeOrder: Order;
  /**
   * The date time at which the previously set UTM parameter was connected to the order
   */
  let previouslyConnectedAt: Date;

  it('Adds UTM parameters to order', async () => {
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    activeOrder = await addItem(shopClient, 'T_1', 1);
    const { addUTMParametersToOrder } = await shopClient.query(
      ADD_UTM_PARAMETERS,
      { input: { source: 'test-source' } }
    );
    expect(addUTMParametersToOrder).toBe(true);
    await adminClient.asSuperAdmin();
    const { order } = await adminClient.query(GET_ORDER_WITH_UTM_PARAMETERS, {
      orderId: activeOrder.id,
    });
    expect(order.utmParameters.length).toBe(1);
    expect(order.utmParameters[0].utmSource).toBe('test-source');
    expect(order.utmParameters[0].utmMedium).toBe(null);
    expect(order.utmParameters[0].utmCampaign).toBe(null);
    expect(order.utmParameters[0].utmTerm).toBe(null);
    expect(order.utmParameters[0].utmContent).toBe(null);
    expect(order.utmParameters[0].attributedPercentage).toBeNull();
    expect(order.utmParameters[0].createdAt).toBeDefined();
    expect(order.utmParameters[0].updatedAt).toBeDefined();
    previouslyConnectedAt = new Date(order.utmParameters[0].connectedAt);
  });

  it('Adds the same UTM parameter to order again', async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait some ms so updatedAt is different
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    const { addUTMParametersToOrder } = await shopClient.query(
      ADD_UTM_PARAMETERS,
      { input: { source: 'test-source' } }
    );
    await expect(addUTMParametersToOrder).toBe(true);
    await adminClient.asSuperAdmin();
    const { order } = await adminClient.query(GET_ORDER_WITH_UTM_PARAMETERS, {
      orderId: activeOrder.id,
    });
    expect(order.utmParameters.length).toBe(1);
    expect(order.utmParameters[0].utmSource).toBe('test-source');
    expect(
      new Date(order.utmParameters[0].connectedAt).getTime()
    ).toBeGreaterThan(previouslyConnectedAt.getTime());
  });

  it('Adds another UTM parameter to order', async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait some ms so updatedAt is different
    const { addUTMParametersToOrder } = await shopClient.query(
      ADD_UTM_PARAMETERS,
      {
        input: {
          source: 'test-source2',
          medium: 'test-medium2',
          campaign: 'test-campaign2',
          term: 'test-term2',
          content: 'test-content2',
        },
      }
    );
    await expect(addUTMParametersToOrder).toBe(true);
    await adminClient.asSuperAdmin();
    const { order } = await adminClient.query(GET_ORDER_WITH_UTM_PARAMETERS, {
      orderId: activeOrder.id,
    });
    expect(order.utmParameters.length).toBe(2);
    expect(order.utmParameters[1].utmSource).toBe('test-source2');
    expect(order.utmParameters[1].utmMedium).toBe('test-medium2');
    expect(order.utmParameters[1].utmCampaign).toBe('test-campaign2');
    expect(order.utmParameters[1].utmTerm).toBe('test-term2');
    expect(order.utmParameters[1].utmContent).toBe('test-content2');
    expect(order.utmParameters[1].attributedPercentage).toBeNull();
  });

  it('Only keeps the most recent 2 UTM parameters after adding a third one', async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait some ms so updatedAt is different
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
  mutation addUTMParametersToOrder($input: UTMParameterInput!) {
    addUTMParametersToOrder(input: $input)
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
