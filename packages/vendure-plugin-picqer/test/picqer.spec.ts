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
import { GET_CONFIG, UPSERT_CONFIG } from '../src/ui/queries';

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

  it('Should update Picqer config via admin api', async () => {
    await adminClient.asSuperAdmin();
    const { upsertPicqerConfig: config } = await adminClient.query(
      UPSERT_CONFIG,
      {
        input: {
          enabled: true,
          apiKey: 'test-api-key',
          apiEndpoint: 'https://test-picqer.io/api/v1/',
          storefrontUrl: 'mystore.io',
          supportEmail: 'support@mystore.io',
        },
      }
    );
    await expect(config.enabled).toBe(true);
    await expect(config.apiKey).toBe('test-api-key');
    await expect(config.apiEndpoint).toBe('https://test-picqer.io/api/v1/');
    await expect(config.storefrontUrl).toBe('mystore.io');
    await expect(config.supportEmail).toBe('support@mystore.io');
  });

  it('Should get Picqer config after upsert', async () => {
    await adminClient.asSuperAdmin();
    const { upsertPicqerConfig: config } = await adminClient.query(GET_CONFIG);
    await expect(config.enabled).toBe(true);
    await expect(config.apiKey).toBe('test-api-key');
    await expect(config.apiEndpoint).toBe('https://test-picqer.io/api/v1/');
    await expect(config.storefrontUrl).toBe('mystore.io');
    await expect(config.supportEmail).toBe('support@mystore.io');
  });

  it('Should push all products to Picqer on full sync', async () => {
    // Asset, description,
    await expect(true).toBe(false);
  });

  it('Should push custom fields to Picqer based on "importFieldsToPicqer" function', async () => {
    await expect(true).toBe(false);
  });

  it('Should pull custom fields from Picqer based on "importFieldsFromPicqer" function', async () => {
    await expect(true).toBe(false);
  });

  it('Should create product in Picqer when product is created in Vendure', async () => {
    await expect(true).toBe(false);
  });

  it('Should updated product in Picqer when product is updated in Vendure', async () => {
    await expect(true).toBe(false);
  });

  afterAll(() => {
    return server.destroy();
  });
});
