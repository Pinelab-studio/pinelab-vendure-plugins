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
import { addCustomerToGroupMutation } from './test-helpers';

describe('Example plugin e2e', function () {
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
      expect(e.response.errors[0].message).toBe(
        'You are not currently authorized to perform this action'
      );
    }
  });

  it('Adds a customer to my group', async () => {
    // FIXME this is actually authenticating as 'trevor_donnelly96@hotmail.com' due to a bug
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    const { addCustomerToMyCustomerManagedGroup: group } =
      await shopClient.query(addCustomerToGroupMutation, {
        emailAddress: 'marques.sawayn@hotmail.com',
      });
    expect(group.name).toBe("Donnelly's Group");
    expect(group.administrators[0].emailAddress).toBe(
      'trevor_donnelly96@hotmail.com'
    );
    expect(group.administrators[1]).toBeUndefined();
    expect(group.participants[0].emailAddress).toBe(
      'marques.sawayn@hotmail.com'
    );
    expect(group.participants[1]).toBeUndefined();
  });

  it('Adds another customer to my group', async () => {
    const { addCustomerToMyCustomerManagedGroup: group } =
      await shopClient.query(addCustomerToGroupMutation, {
        emailAddress: 'stewart.lindgren@gmail.com',
      });
    expect(group.participants[0].emailAddress).toBe(
      'marques.sawayn@hotmail.com'
    );
    expect(group.participants[1].emailAddress).toBe(
      'stewart.lindgren@gmail.com'
    );
  });

  it('Fails when a participant tries to add customers', async () => {
    expect.assertions(1);
    // FIXME this is actually authenticating as 'stewart.lindgren@gmail.com' due to a bug
    await shopClient.asUserWithCredentials('eliezer56@yahoo.com', 'test');
    try {
      await shopClient.query(addCustomerToGroupMutation, {
        emailAddress: 'marques.sawayn@hotmail.com',
      });
    } catch (e) {
      expect(e.response.errors[0].message).toBe(
        'Customer stewart.lindgren@gmail.com is not group administrator'
      );
    }
  });

  it('Adds a group admin as administrator', async () => {
    // TODO
  });

  it('Removes an admin from the group ', async () => {
    // Should also remove the admin relation
    // TODO
  });

  it('Places an order for the group participant', async () => {
    expect(true).toBe(false);
  });

  it('Places an order for the group admin', async () => {
    expect(true).toBe(false);
  });

  it('Fetches 2 orders for the group admin', async () => {
    expect(true).toBe(false);
  });

  it('Fetches 1 orders for the group participant', async () => {
    expect(true).toBe(false);
  });

  afterAll(() => {
    return server.destroy();
  });
});
