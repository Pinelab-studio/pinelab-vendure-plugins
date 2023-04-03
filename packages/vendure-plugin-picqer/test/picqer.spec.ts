import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  SimpleGraphQLClient,
  SqljsInitializer,
  createTestEnvironment,
  registerInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import nock from 'nock';
import { initialData } from '../../test/src/initial-data';
import { PicqerPlugin } from '../src';
import { VatGroup } from '../src/api/types';
import { FULL_SYNC, GET_CONFIG, UPSERT_CONFIG } from '../src/ui/queries';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
const apiUrl = 'https://test-picqer.io/api/v1/';

describe('Order export plugin', function () {
  // Clear nock mocks after each test
  afterEach(() => nock.cleanAll());

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        PicqerPlugin.init({
          enabled: true,
          pushFieldsToPicqer: (variant) => ({ barcode: variant.sku }),
        }),
      ],
    });

    ({ server, adminClient } = createTestEnvironment(config));
    await server.init({
      initialData,
      productsCsvPath: '../test/src/products-import.csv',
    });
  }, 60000);

  it('Should start successfully', async () => {
    expect(server.app.getHttpServer).toBeDefined();
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
    const { picqerConfig: config } = await adminClient.query(GET_CONFIG);
    await expect(config.enabled).toBe(true);
    await expect(config.apiKey).toBe('test-api-key');
    await expect(config.apiEndpoint).toBe('https://test-picqer.io/api/v1/');
    await expect(config.storefrontUrl).toBe('mystore.io');
    await expect(config.supportEmail).toBe('support@mystore.io');
  });

  let pushProductPayloads: any[] = [];

  it('Should push all products to Picqer on full sync', async () => {
    // Mock vatgroups GET
    nock(apiUrl)
      .get('/vatgroups')
      .reply(200, [{ idvatgroup: 12, percentage: 20 }] as VatGroup[]);
    // Mock products GET multiple times
    nock(apiUrl)
      .get(/.products*/)
      .reply(200, [])
      .persist();
    // Mock product POST multiple times
    nock(apiUrl)
      .post(/.*/, (reqBody) => {
        pushProductPayloads.push(reqBody);
        return true;
      })
      .reply(200, {
        data: { idproduct: 'mockId' },
      })
      .persist();
    const { triggerPicqerFullSync } = await adminClient.query(FULL_SYNC);
    await new Promise((r) => setTimeout(r, 500)); // Wait for job queue to finish
    expect(pushProductPayloads.length).toBe(4);
    expect(triggerPicqerFullSync).toBe(true);
  });

  it('Should push custom fields to Picqer based on configured plugin strategy', async () => {
    const pushedProduct = pushProductPayloads.find(
      (p) => p.productcode === 'L2201516'
    );
    // Expect the barcode to be the same as SKU, because thats what we configure in the plugin.init()
    expect(pushedProduct?.barcode).toBe('L2201516');
  });

  it.skip('Should create product in Picqer when product is created in Vendure', async () => {
    expect(true).toBe(false);
  });

  it.skip('Should updated product in Picqer when product is updated in Vendure', async () => {
    expect(true).toBe(false);
  });

  it.skip('Should pull custom fields from Picqer based on configured plugin strategy', async () => {
    expect(true).toBe(false);
  });

  it.skip('Should pull custom fields from Picqer based on "importFieldsFromPicqer" function', async () => {
    expect(true).toBe(false);
  });

  afterAll(() => {
    return server.destroy();
  });
});
