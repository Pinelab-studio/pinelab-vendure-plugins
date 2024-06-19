import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import path from 'path';
import { initialData } from '../../test/src/initial-data';
import { PaymentExtensionsPlugin } from '../src/payment-extensions-plugin';

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
      PaymentExtensionsPlugin,
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
      }),
    ],
    apiOptions: {
      shopApiPlayground: true,
      adminApiPlayground: true,
    },
  });
  const { server } = createTestEnvironment(devConfig);
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
    customerCount: 2,
  });
})();
