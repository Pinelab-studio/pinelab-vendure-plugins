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
import { describe, beforeAll, it, expect } from 'vitest';
import { PublicCustomerGroupsPlugin } from '../src/public-customer-groups.plugin';
import {
  CREATE_CUSTOMER_GROUP,
  getActiveCustomer,
  nonPublicCustomerGroupInput,
  publicCustomerGroupInput,
} from './test-helpers';

describe('Public Customer Groups', function () {
  let server: TestServer;
  let shopClient: SimpleGraphQLClient;
  let adminClient: SimpleGraphQLClient;
  let serverStarted = false;
  let publicCustomerGroupId;
  let nonPublicCustomerGroupId;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [PublicCustomerGroupsPlugin],
      paymentOptions: {
        paymentMethodHandlers: [testPaymentMethod],
      },
    });

    ({ server, shopClient, adminClient } = createTestEnvironment(config));
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
    serverStarted = true;
    await adminClient.asSuperAdmin();
    //create a public customer group
    publicCustomerGroupId = (
      (await adminClient.query(CREATE_CUSTOMER_GROUP, {
        input: publicCustomerGroupInput,
      })) as any
    ).createCustomerGroup.id;
    //create a non public customer group
    nonPublicCustomerGroupId = (
      (await adminClient.query(CREATE_CUSTOMER_GROUP, {
        input: nonPublicCustomerGroupInput,
      })) as any
    ).createCustomerGroup.id;
  }, 60000);

  it('Should start successfully', async () => {
    expect(serverStarted).toBe(true);
  });

  it('Should fetch only public customer groups for customer and activeCustomer.customerGroups.customers should also be empty', async () => {
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    const {
      activeCustomer: { customerGroups },
    } = await shopClient.query(getActiveCustomer);
    expect(
      customerGroups.find(
        (customerGroup) => customerGroup.id === publicCustomerGroupId
      )
    ).toBeDefined();
    expect(
      customerGroups.find(
        (customerGroup) => customerGroup.id === nonPublicCustomerGroupId
      )
    ).not.toBeDefined();
    for (let customerGroup of customerGroups) {
      expect(customerGroup.customers.items.length).toBe(0);
    }
  });
});
