import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
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
  testConfig,
} from '@vendure/testing';
import path from 'path';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { ChangeOrderCustomerPlugin } from '../src/change-order-customer.plugin';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import { addItem } from '../../test/src/shop-utils';

require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      AssetServerPlugin.init({
        assetUploadDir: path.join(__dirname, '__data__/assets'),
        route: 'assets',
      }),
      ChangeOrderCustomerPlugin,
      AdminUiPlugin.init({
        route: 'admin',
        port: 3002,
        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [ChangeOrderCustomerPlugin.ui],
          devMode: true,
        }),
      }),
      DefaultSearchPlugin,
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
  const { server, shopClient } = createTestEnvironment(devConfig);
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
  await addItem(shopClient, 'T_1', 1);
})();
