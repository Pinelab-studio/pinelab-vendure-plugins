import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { CustomerManagedGroupsPlugin } from '../src';
import {
  addCustomerToGroupMutation,
  getOrdersForMyCustomerManagedGroup,
} from './test-helpers';
import { createSettledOrder } from '../../test/src/shop-utils';

describe('Customer managed groups', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [CustomerManagedGroupsPlugin],
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
      customerCount: 5,
    });
  }, 60000);

  async function authorizeAsGroupAdmin(): Promise<void> {
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
  }

  async function authorizeAsGroupParticipant(): Promise<void> {
    await shopClient.asUserWithCredentials('eliezer56@yahoo.com', 'test');
  }

  it('Should start successfully', async () => {
    expect(server.app.getHttpServer).toBeDefined;
  });

  it('Fails for unauthenticated calls', async () => {
    expect.assertions(1);
    try {
      await shopClient.query(addCustomerToGroupMutation, {
        emailAddress: 'marques.sawayn@hotmail.com',
      });
    } catch (e) {
      expect((e as any).response.errors[0].message).toBe(
        'You are not currently authorized to perform this action'
      );
    }
  });

  it('Adds a customer to my group', async () => {
    await authorizeAsGroupAdmin();
    const { addCustomerToMyCustomerManagedGroup: group } =
      await shopClient.query(addCustomerToGroupMutation, {
        emailAddress: 'marques.sawayn@hotmail.com',
      });
    expect(group.name).toBe("Zieme's Group");
    expect(group.administrators[0].emailAddress).toBe(
      'hayden.zieme12@hotmail.com'
    );
    expect(group.administrators[1]).toBeUndefined();
    expect(group.participants[0].emailAddress).toBe(
      'marques.sawayn@hotmail.com'
    );
    expect(group.participants[1]).toBeUndefined();
  });

  it('Adds another customer to my group', async () => {
    await authorizeAsGroupAdmin();
    const { addCustomerToMyCustomerManagedGroup: group } =
      await shopClient.query(addCustomerToGroupMutation, {
        emailAddress: 'eliezer56@yahoo.com',
      });
    expect(group.participants[0].emailAddress).toBe(
      'marques.sawayn@hotmail.com'
    );
    expect(group.participants[1].emailAddress).toBe('eliezer56@yahoo.com');
  });

  it('Fails when a participant tries to add customers', async () => {
    expect.assertions(1);
    await authorizeAsGroupParticipant();
    try {
      await shopClient.query(addCustomerToGroupMutation, {
        emailAddress: 'marques.sawayn@hotmail.com',
      });
    } catch (e) {
      expect((e as any).response.errors[0].message).toBe(
        'You are not administrator of your group'
      );
    }
  });

  it.skip('Adds a group admin as administrator', async () => {
    // TODO
  });

  it.skip('Removes an admin from the group ', async () => {
    // Should also remove the admin relation
    // TODO
  });

  it('Places an order for the group participant', async () => {
    await authorizeAsGroupParticipant();
    const order = await createSettledOrder(shopClient, 1, false);
    expect(order.code).toBeDefined();
  });

  it('Places an order for the group admin', async () => {
    await authorizeAsGroupAdmin();
    const order = await createSettledOrder(shopClient, 1, false);
    expect(order.code).toBeDefined();
  });

  it('Fails to fetch orders when unauthenticated', async () => {
    expect.assertions(1);
    await shopClient.asAnonymousUser();
    try {
      await shopClient.query(getOrdersForMyCustomerManagedGroup);
    } catch (e) {
      expect((e as any).response.errors[0].message).toBe(
        'You are not currently authorized to perform this action'
      );
    }
  });

  it('Fails to fetch orders for participants', async () => {
    expect.assertions(1);
    await authorizeAsGroupParticipant();
    try {
      await shopClient.query(getOrdersForMyCustomerManagedGroup);
    } catch (e) {
      expect((e as any).response.errors[0].message).toBe(
        'You are not administrator of your group'
      );
    }
  });

  it('Fetches 2 orders for the group admin', async () => {
    await authorizeAsGroupAdmin();
    const orders = await shopClient.query(getOrdersForMyCustomerManagedGroup);
    expect(orders.ordersForMyCustomerManagedGroup.totalItems).toBe(2);
  });

  it.skip('Fetches 1 orders for the group participant', async () => {
    expect(true).toBe(false);
  });

  afterAll(() => {
    return server.destroy();
  });
});
