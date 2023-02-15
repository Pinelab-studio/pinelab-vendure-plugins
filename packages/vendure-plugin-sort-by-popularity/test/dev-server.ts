import { initialData } from '../../test/src/initial-data';
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
import path from 'path';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler/';
import { SortByPopularityPlugin } from '../src';

require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      SortByPopularityPlugin,
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        /*                app: compileUiExtensions({
                    outputPath: path.join(__dirname, "__admin-ui"),
                    extensions: [
                        // TODO Add your plugin's UI here
                    ],
                    devMode: true
                })*/
      }),
    ],
    apiOptions: {
      shopApiPlayground: true,
      adminApiPlayground: true,
    },
  });
  const { server, adminClient, shopClient } = createTestEnvironment(devConfig);
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
})();
