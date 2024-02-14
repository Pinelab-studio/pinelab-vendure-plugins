import { DefaultLogger, ID, LogLevel, mergeConfig } from '@vendure/core';
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
import { addItem } from '../../test/src/shop-utils';
import { ChangeOrderCustomerPlugin } from '../src/change-order-customer.plugin';
import { CHANGE_ORDER_CUSTOMER, GET_ANY_CUSTOMER } from './helpers';
import { CreateCustomerInput } from '../../test/src/generated/admin-graphql';

describe('Change Order Customer Plugin', function () {
  let server: TestServer;
  let shopClient: SimpleGraphQLClient;
  let adminClient: SimpleGraphQLClient;
  let serverStarted = false;
  let orderId: ID;
  let customerId: ID;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [ChangeOrderCustomerPlugin],
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
    orderId = (await addItem(shopClient, 'T_1', 1)).id;
    const { customers } = await adminClient.query(GET_ANY_CUSTOMER);
    customerId = customers.items[0].id;
  }, 60000);
  it('Should start successfully', async () => {
    expect(serverStarted).toBe(true);
  });

  it("Should change an Order's Customer to an existing customer", async () => {
    const { setCustomerForOrder } = await adminClient.query(
      CHANGE_ORDER_CUSTOMER,
      { orderId, customerId }
    );
    expect(setCustomerForOrder.id).toBe(orderId);
    expect(setCustomerForOrder.customer.id).toBe(customerId);
  });

  it("Should change an Order's Customer to a new customer", async () => {
    const createCustomerInput: CreateCustomerInput = {
      emailAddress: `some.${Math.random()}@gmail.com`,
      firstName: 'Michael',
      lastName: 'Tomas',
    };
    const { setCustomerForOrder } = await adminClient.query(
      CHANGE_ORDER_CUSTOMER,
      { orderId, input: createCustomerInput }
    );
    expect(setCustomerForOrder.id).toBe(orderId);
    expect(setCustomerForOrder.customer.emailAddress).toBe(
      createCustomerInput.emailAddress
    );
    expect(setCustomerForOrder.customer.firstName).toBe(
      createCustomerInput.firstName
    );
    expect(setCustomerForOrder.customer.lastName).toBe(
      createCustomerInput.lastName
    );
  });
});
