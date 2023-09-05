import { createSettledOrder } from '../../test/src/shop-utils';

require('dotenv').config();
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
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
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import * as path from 'path';
import { DefaultExportStrategy, OrderExportPlugin } from '../src';

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminApiPlayground: {},
      shopApiPlayground: {},
    },
    plugins: [
      DefaultSearchPlugin,
      OrderExportPlugin.init({
        exportStrategies: [new DefaultExportStrategy()],
      }),
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [OrderExportPlugin.ui],
          devMode: true,
        }),
      }),
    ],
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
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
  //FIX ME
  await createSettledOrder(shopClient, 1);
  await createSettledOrder(shopClient, 1);
  await createSettledOrder(shopClient, 1);
})();
