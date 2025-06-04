import {
  CustomerGroupService,
  DefaultLogger,
  LanguageCode,
  LogLevel,
  PaymentMethod,
  PaymentMethodService,
  mergeConfig,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { PaymentExtensionsPlugin } from '../src/payment-extensions-plugin';
import { getSuperadminContext } from '@vendure/testing/lib/utils/get-superadmin-context';
import { settleWithoutPaymentHandler } from '../src/settle-without-payment-handler';
import { createSettledOrder } from '../../test/src/shop-utils';
import { isCustomerInGroupPaymentChecker } from '../src/is-customer-In-group-payment-checker';

let server: TestServer;
let shopClient: SimpleGraphQLClient;
let settleWithoutPaymentMethod: PaymentMethod;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [PaymentExtensionsPlugin],
  });

  ({ server, shopClient } = createTestEnvironment(config));
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
    customerCount: 2,
  });
  //create a customer group with customer 1 as a member
  const customerGroupService = server.app.get(CustomerGroupService);
  const paymentMethodService = server.app.get(PaymentMethodService);
  const ctx = await getSuperadminContext(server.app);
  const settleWithoutPaymentCustomerGroup = await customerGroupService.create(
    ctx,
    {
      name: 'Settle Without Payment Group',
      customerIds: ['1'],
    }
  );
  //create a payment method with isCustomerInGroupPaymentChecker and settleWithoutPaymentHandler
  settleWithoutPaymentMethod = await paymentMethodService.create(ctx, {
    code: 'settle-without-payment',
    enabled: true,
    handler: {
      arguments: [],
      code: settleWithoutPaymentHandler.code,
    },
    checker: {
      arguments: [
        {
          name: 'customerGroupId',
          value: JSON.stringify(settleWithoutPaymentCustomerGroup.id),
        },
      ],
      code: isCustomerInGroupPaymentChecker.code,
    },
    translations: [
      {
        languageCode: LanguageCode.en,
        name: 'Settle Without Payment',
      },
    ],
  });
}, 60000);

it('Should start successfully', () => {
  expect(server.app.getHttpServer()).toBeDefined();
});

it('it should settle payment for Customer(1) with "settle-without-payment" PaymentMethod', async () => {
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  console.log('settleWithoutPaymentMethod', settleWithoutPaymentMethod);
  const order = await createSettledOrder(
    shopClient,
    1,
    false,
    [
      { id: 'T_1', quantity: 1 },
      { id: 'T_2', quantity: 2 },
    ],
    undefined,
    undefined,
    settleWithoutPaymentMethod.code
  );
  expect(order.id).toBeDefined();
});

it('it should not settle payment for Customer(2) with "settle-without-payment" PaymentMethod', async () => {
  await shopClient.asUserWithCredentials(
    'trevor_donnelly96@hotmail.com',
    'test'
  );
  try {
    const order = await createSettledOrder(
      shopClient,
      1,
      false,
      [
        { id: 'T_1', quantity: 1 },
        { id: 'T_2', quantity: 2 },
      ],
      undefined,
      undefined,
      settleWithoutPaymentMethod.code
    );
  } catch (e: any) {
    expect(e.message).toMatch(`Failed to create settled order:`);
  }
});

afterAll(() => {
  return server.destroy();
});
