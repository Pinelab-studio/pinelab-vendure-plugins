import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import path from 'path';
import { initialData } from '../../test/src/initial-data';
import { PicqerPlugin } from '../src';

describe('Example plugin e2e', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        PicqerPlugin.init({
          enabled: true,
        }),
      ],
    });

    ({ server, adminClient, shopClient } = createTestEnvironment(config));
    await server.init({
      initialData,
      productsCsvPath: path.join(__dirname, './product-import.csv'),
    });
  }, 60000);

  it('Should start successfully', async () => {
    await expect(server.app.getHttpServer).toBeDefined;
  });

  it('Should push all products to Picqeron full sync', async () => {
    // Asset, description,
    await expect(true).tobe(false);
  });

  it('Should push custom fields to Picqer based on "importFieldsToPicqer" function', async () => {
    await expect(true).tobe(false);
  });

  it('Should create product in Picqer when product is created in Vendure', async () => {
    await expect(true).tobe(false);
  });

  it('Should updated product in Picqer when product is updated in Vendure', async () => {
    await expect(true).tobe(false);
  });

  afterAll(() => {
    return server.destroy();
  });
});
