require('dotenv').config();
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  InitialData,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import { initialData } from '../../test/src/initial-data';
import { VendureShipmatePlugin } from '../src/shipmate.plugin';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler/';
import path from 'path';

(async () => {
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      VendureShipmatePlugin,
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [VendureShipmatePlugin.ui],
          devMode: true,
        }),
      }),
    ],
    apiOptions: {
      shopApiPlayground: true,
      adminApiPlayground: true,
    },
    authOptions: {
      tokenMethod: 'bearer',
    },
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
  });
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const { server } = createTestEnvironment(config);
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
})();
