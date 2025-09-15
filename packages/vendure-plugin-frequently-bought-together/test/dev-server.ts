import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  InitialData,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import { FrequentlyBoughtTogetherPlugin } from '../src';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';

require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      shopApiPlayground: true,
      adminApiPlayground: true,
    },
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
    plugins: [
      FrequentlyBoughtTogetherPlugin.init({
        experimentMode: true,
        supportLevel: 0.001,
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [FrequentlyBoughtTogetherPlugin.ui],
          devMode: true,
        }),
      }),
    ],
  });
  const { server, shopClient, adminClient } = createTestEnvironment(config);
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
    productsCsvPath: './test/products-import.csv',
  });

  await createSettledOrder(shopClient, 1, true, [
    { id: 'T_1', quantity: 1 },
    { id: 'T_2', quantity: 1 },
  ]);
  await createSettledOrder(shopClient, 1, true, [
    { id: 'T_1', quantity: 1 },
    { id: 'T_3', quantity: 1 },
  ]);
  await createSettledOrder(shopClient, 1, true, [
    { id: 'T_1', quantity: 1 },
    { id: 'T_3', quantity: 1 },
  ]);
  await createSettledOrder(shopClient, 1, true, [
    { id: 'T_2', quantity: 1 },
    { id: 'T_3', quantity: 1 },
  ]);
})();
