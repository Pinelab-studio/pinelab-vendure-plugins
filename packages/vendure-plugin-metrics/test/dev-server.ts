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
import { MetricsPlugin } from '../src/MetricsPlugin';
import { createSettledOrder } from '../../test/src/shop-utils';

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
    plugins: [
      MetricsPlugin,
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [MetricsPlugin.ui],
          devMode: true,
        }),
      }),
    ],
  });
  const { server, shopClient } = createTestEnvironment(config);
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
  await createSettledOrder(shopClient, 1);
  await createSettledOrder(shopClient, 1);
  await createSettledOrder(shopClient, 1);
  await createSettledOrder(shopClient, 1);
  await createSettledOrder(shopClient, 1);
})();
