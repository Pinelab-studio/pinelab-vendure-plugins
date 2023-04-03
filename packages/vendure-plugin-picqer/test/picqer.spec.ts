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
import { FULL_SYNC, GET_CONFIG, UPSERT_CONFIG } from '../src/ui/queries';
import nock, { Scope } from 'nock';
import test from 'ava';

console.log('before================')


let server: TestServer;
let adminClient: SimpleGraphQLClient;
let nockScope = nock('https://test-picqer.io/api/v1/');

// Clear nock mocks after each test
test.afterEach(() => nock.cleanAll());

  console.log('before')

test.before(async (t) => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      PicqerPlugin.init({
        enabled: true,
      }),
    ],
  });

  ({ server, adminClient } = createTestEnvironment(config));
  await server.init({
    initialData,
    productsCsvPath: path.join(__dirname, './product-import.csv'),
  });
});

test('Should start successfully', async (t) => {
  t.truthy(server.app.getHttpServer);
});

// it('Should update Picqer config via admin api', async () => {
//   await adminClient.asSuperAdmin();
//   const { upsertPicqerConfig: config } = await adminClient.query(
//     UPSERT_CONFIG,
//     {
//       input: {
//         enabled: true,
//         apiKey: 'test-api-key',
//         apiEndpoint: 'https://test-picqer.io/api/v1/',
//         storefrontUrl: 'mystore.io',
//         supportEmail: 'support@mystore.io',
//       },
//     }
//   );
//   await expect(config.enabled).toBe(true);
//   await expect(config.apiKey).toBe('test-api-key');
//   await expect(config.apiEndpoint).toBe('https://test-picqer.io/api/v1/');
//   await expect(config.storefrontUrl).toBe('mystore.io');
//   await expect(config.supportEmail).toBe('support@mystore.io');
// });

// it('Should get Picqer config after upsert', async () => {
//   await adminClient.asSuperAdmin();
//   const { upsertPicqerConfig: config } = await adminClient.query(GET_CONFIG);
//   await expect(config.enabled).toBe(true);
//   await expect(config.apiKey).toBe('test-api-key');
//   await expect(config.apiEndpoint).toBe('https://test-picqer.io/api/v1/');
//   await expect(config.storefrontUrl).toBe('mystore.io');
//   await expect(config.supportEmail).toBe('support@mystore.io');
// });

// it('Should push all products to Picqer on full sync', async () => {
//   let payload: any;
//   nockScope.get(/.products*/).reply(200, [{productCode: 'L2201508'}]);
//   nockScope.post('/products', (reqBody) => {
//     console.log('TESTINGGG=======', reqBody)
//     payload = reqBody;
//     return true;
//   })
//   .reply(200, {
//     data: { hosted_url: 'https://mock-hosted-checkout/charges' },
//   });

//   const { triggerPicqerFullSync } = await adminClient.query(FULL_SYNC);
//   await new Promise((r) => setTimeout(r, 500)); // Wait for job queue to finish
//   await expect(triggerPicqerFullSync).toBe(true);
// });

// it('Should push custom fields to Picqer based on "importFieldsToPicqer" function', async () => {
//   await expect(true).toBe(false);
// });

// it('Should pull custom fields from Picqer based on "importFieldsFromPicqer" function', async () => {
//   await expect(true).toBe(false);
// });

// it('Should create product in Picqer when product is created in Vendure', async () => {
//   await expect(true).toBe(false);
// });

// it('Should updated product in Picqer when product is updated in Vendure', async () => {
//   await expect(true).toBe(false);
// });

test.after(() => {
  return server.destroy();
});
