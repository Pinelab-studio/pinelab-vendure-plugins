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
  InitialData,
} from '@vendure/core';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import { GoogleStorageStrategy } from '../src';
import { GoogleStoragePlugin } from '../src';
import { initialData } from '../../test/src/initial-data';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import dotenv from 'dotenv';

(async () => {
  dotenv.config(); // Needed for GCLOUD_PROJECT
  testConfig.logger = new DefaultLogger({ level: LogLevel.Debug });
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  testConfig.plugins.push(
    AssetServerPlugin.init({
      storageStrategyFactory: () =>
        new GoogleStorageStrategy({
          bucketName: process.env.BUCKET!,
        }),
      route: 'assets',
      assetUploadDir: '/tmp/vendure/assets',
    }),
  );
  testConfig.plugins.push(GoogleStoragePlugin);
  testConfig.plugins.push(DefaultSearchPlugin);
  testConfig.plugins.push(AdminUiPlugin.init({ route: 'admin', port: 3002 }));
  testConfig.apiOptions.shopApiPlayground = {};
  testConfig.apiOptions.adminApiPlayground = {};
  const { server } = createTestEnvironment(testConfig);
  await server.init({
    initialData: initialData as InitialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
})();
