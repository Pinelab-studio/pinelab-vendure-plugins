import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
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
} from '@vendure/testing';
import { PicqerPlugin } from '../src';
import { initialData } from '../../test/src/initial-data';
import path from 'path';
import { FULL_SYNC, UPSERT_CONFIG } from '../src/ui/queries';

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
      PicqerPlugin.init({
        enabled: true,
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        // app: compileUiExtensions({
        //   outputPath: path.join(__dirname, '__admin-ui'),
        //   extensions: [PicqerPlugin.ui],
        //   devMode: true,
        // }),
      }),
    ],
  });
  const { server, shopClient, adminClient } = createTestEnvironment(config);
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
  await adminClient.asSuperAdmin();
  await adminClient.query(UPSERT_CONFIG, {
    input: {
      enabled: true,
      apiKey: process.env.APIKEY,
      apiEndpoint: process.env.ENDPOINT,
      storefrontUrl: 'mystore.io',
      supportEmail: 'support@mystore.io',
    },
  });
  await adminClient.query(FULL_SYNC);
})();
