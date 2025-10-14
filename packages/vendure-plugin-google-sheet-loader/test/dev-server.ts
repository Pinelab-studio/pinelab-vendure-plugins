import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import { initialData } from '../../test/src/initial-data';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import path from 'path';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import { GoogleSheetLoaderPlugin } from '../src';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { TestDataStrategy } from './test-data-strategy';

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
    dbConnectionOptions: {
      autoSave: true,
    },
    plugins: [
      GoogleSheetLoaderPlugin.init({
        strategies: [new TestDataStrategy()],
        googleApiKey: process.env.GOOGLE_SHEET_API_KEY!,
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [GoogleSheetLoaderPlugin.ui],
          devMode: true,
        }),
      }),
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
})();
