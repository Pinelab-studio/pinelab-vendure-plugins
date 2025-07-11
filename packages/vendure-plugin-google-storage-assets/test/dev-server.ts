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
  mergeConfig,
} from '@vendure/core';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import { GoogleStorageStrategy } from '../src';
import { GoogleStorageAssetsPlugin } from '../src';
import { initialData } from '../../test/src/initial-data';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import dotenv from 'dotenv';

(async () => {
  dotenv.config(); // Needed for GCLOUD_PROJECT
  testConfig.logger = new DefaultLogger({ level: LogLevel.Debug });
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devServerConfig = mergeConfig(testConfig, {
    dbConnectionOptions: {
      autoSave: true,
    },
    plugins: [
      AssetServerPlugin.init({
        storageStrategyFactory: () => new GoogleStorageStrategy(),
        route: 'assets',
        assetUploadDir: '/tmp/vendure/assets',
      }),
      GoogleStorageAssetsPlugin.init({
        bucketName: process.env.BUCKET!,
        presets: {
          // 500 x height webp thumbnail
          thumbnail: {
            extension: 'webp',
            generateFn: (sharp) =>
              sharp
                .resize(500)
                .toFormat('webp', { quality: 80, smartSubsample: true })
                .toBuffer(),
          },
          webpPreview: {
            extension: 'webp',
            generateFn: (sharp) =>
              sharp.resize(1500).toFormat('webp').toBuffer(),
          },
        },
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({ route: 'admin', port: 3002 }),
    ],
  });
  const { server } = createTestEnvironment(devServerConfig);
  await server.init({
    initialData: initialData as InitialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
})();
