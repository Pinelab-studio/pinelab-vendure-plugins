import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  AutoIncrementIdStrategy,
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
import { initialTestData } from './initial-test-data';
import { PrimaryCollectionPlugin } from '../src/primary-collection-plugin';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import path from 'path';

require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      PrimaryCollectionPlugin,
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [PrimaryCollectionPlugin.ui],
          devMode: true,
        }),
      }),
    ],
    apiOptions: {
      shopApiPlayground: true,
      adminApiPlayground: true,
    },
    entityOptions: {
      entityIdStrategy: new AutoIncrementIdStrategy(),
    },
  });
  const { server, adminClient, shopClient } = createTestEnvironment(devConfig);
  await server.init({
    initialData: initialTestData,
    productsCsvPath: './test/products.csv',
  });
})();
