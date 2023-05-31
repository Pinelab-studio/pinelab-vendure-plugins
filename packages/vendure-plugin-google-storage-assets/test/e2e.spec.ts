import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import {
  DefaultLogger,
  InitialData,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import { TestServer } from '@vendure/testing/lib/test-server';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import { GoogleStoragePlugin, GoogleStorageStrategy } from '../src';
import { describe, it, expect, afterAll, beforeAll } from 'vitest';

describe('Google Storage Assets plugin', () => {
  let server: TestServer;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        port: 3102,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        AssetServerPlugin.init({
          storageStrategyFactory: () =>
            new GoogleStorageStrategy({
              bucketName: 'testBucket',
            }),
          route: 'assets',
          assetUploadDir: '/tmp/vendure/assets',
        }),
        GoogleStoragePlugin,
      ],
    });
    ({ server } = createTestEnvironment(config));
    await server.init({
      initialData: initialData as InitialData,
      productsCsvPath: '../test/src/products-import.csv',
    });
  });

  it('Should start server', async () => {
    await expect(server.app.getHttpServer).toBeDefined();
  });

  afterAll(() => {
    return server.destroy();
  });
});
