import { initialData } from '../../test/initialData';
import { MyparcelPlugin } from '../src/myparcel.plugin';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  defaultShippingCalculator,
  defaultShippingEligibilityChecker,
  InitialData,
  LanguageCode,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  ADD_ITEM_TO_ORDER,
  CREATE_PAYMENT_METHOD,
  CREATE_SHIPPING_METHOD,
} from './queries';
import {
  addPaymentToOrder,
  proceedToArrangingPayment,
  testSuccessfulPaymentMethod,
} from './test-order-utils';

require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      MyparcelPlugin.init({
        'e2e-default-channel': process.env.MYPARCEL_APIKEY!,
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
      }),
    ],
    paymentOptions: {
      paymentMethodHandlers: [testSuccessfulPaymentMethod],
    },
  });
  const { server, adminClient, shopClient } = createTestEnvironment(config);
  await server.init({
    initialData: {
      ...(initialData as InitialData),
      paymentMethods: [
        {
          name: testSuccessfulPaymentMethod.code,
          handler: { code: testSuccessfulPaymentMethod.code, arguments: [] },
        },
      ],
    },
    productsCsvPath: '../test/products-import.csv',
    customerCount: 2,
  });

  // Add a test-order at every server start

  await adminClient.asSuperAdmin();
  await adminClient.query(CREATE_SHIPPING_METHOD, {
    input: {
      code: 'test-shipping-method',
      fulfillmentHandler: 'my-parcel',
      checker: {
        code: defaultShippingEligibilityChecker.code,
        arguments: [
          {
            name: 'orderMinimum',
            value: '0',
          },
        ],
      },
      calculator: {
        code: defaultShippingCalculator.code,
        arguments: [
          {
            name: 'rate',
            value: '500',
          },
          {
            name: 'taxRate',
            value: '0',
          },
        ],
      },
      translations: [
        { languageCode: LanguageCode.en, name: 'test method', description: '' },
      ],
    },
  });
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  await shopClient.query(ADD_ITEM_TO_ORDER, {
    productVariantId: 'T_1',
    quantity: 1,
  });
  await shopClient.query(ADD_ITEM_TO_ORDER, {
    productVariantId: 'T_2',
    quantity: 1,
  });
  await proceedToArrangingPayment(shopClient);
  await addPaymentToOrder(shopClient, testSuccessfulPaymentMethod);
})();
