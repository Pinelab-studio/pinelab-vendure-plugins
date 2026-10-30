import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import { addItem, createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { MetricsPlugin } from '../src/';

(async () => {
  require('dotenv').config();
  const { testConfig } = require('@vendure/testing');
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminApiPlayground: {},
      shopApiPlayground: {},
    },
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
    plugins: [
      MetricsPlugin.init({
        displayPastMonths: 19,
      }),
      DefaultSearchPlugin,
    ],
  });
  const { server, shopClient } = createTestEnvironment(config);
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
  // Create placed orders
  await createSettledOrder(shopClient, 1);
  await createSettledOrder(shopClient, 1);
  await createSettledOrder(shopClient, 1);
  await createSettledOrder(shopClient, 1);
  await createSettledOrder(shopClient, 1);
  // Also create some non-finished orders for conversion metric
  for (let i = 0; i < 10; i++) {
    await shopClient.asAnonymousUser();
    await addItem(shopClient, '1', 1);
  }
})();
