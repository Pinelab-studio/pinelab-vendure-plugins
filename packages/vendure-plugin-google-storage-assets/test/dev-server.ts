import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  InitialData,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import dotenv from 'dotenv';
import { initialData } from '../../test/src/initial-data';
import { GoogleStorageAssetsPlugin, GoogleStorageStrategy } from '../src';

(async () => {
  dotenv.config(); // Needed for GCLOUD_PROJECT
  testConfig.logger = new DefaultLogger({ level: LogLevel.Info });
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devServerConfig = mergeConfig(testConfig, {
    dbConnectionOptions: {
      autoSave: true,
    },
    authOptions: {
      tokenMethod: ['bearer', 'cookie'],
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
    ],
  });
  const { server } = createTestEnvironment(devServerConfig);
  await server.init({
    initialData: initialData as InitialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
})();
