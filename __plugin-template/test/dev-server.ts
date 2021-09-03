require('dotenv').config();
import { SimpleCmsPlugin } from '../src/SimpleCmsPlugin';
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
import { initialData } from '../../test/initialData';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import path from 'path';

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      SimpleCmsPlugin,
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [SimpleCmsPlugin.ui],
          devMode: true,
        }),
      }),
    ],
  });
  const { server } = createTestEnvironment(config);
  await server.init({
    initialData: initialData as InitialData,
    productsCsvPath: '../test/products-import.csv',
  });
})();
