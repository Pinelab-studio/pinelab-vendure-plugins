import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import getFilesInAdminUiFolder from '../../test/src/compile-admin-ui.util';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { GoogleSheetLoaderPlugin } from '../src';
import { TestDataStrategy } from './test-data-strategy';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;
let serverStarted = false;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    apiOptions: {
      adminListQueryLimit: 10000,
      port: 3106,
    },
    logger: new DefaultLogger({ level: LogLevel.Info }),
    dbConnectionOptions: {
      autoSave: true,
    },
    plugins: [
      GoogleSheetLoaderPlugin.init({
        strategies: [new TestDataStrategy()],
        googleApiKey: 'test-api-key',
      }),
    ],
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
  });

  ({ server, adminClient, shopClient } = createTestEnvironment(config));
  await server.init({
    initialData: {
      ...initialData,
      paymentMethods: [
        {
          name: testPaymentMethod.code,
          handler: { code: testPaymentMethod.code, arguments: [] },
        },
      ],
    },
    productsCsvPath: '../test/src/products-import.csv',
  });
  serverStarted = true;
  await adminClient.asSuperAdmin();
}, 60000);

it('Should start successfully', async () => {
  expect(serverStarted).toBe(true);
});

if (process.env.TEST_ADMIN_UI) {
  it('Should compile admin UI', async () => {
    const files = await getFilesInAdminUiFolder(
      __dirname,
      GoogleSheetLoaderPlugin.ui
    );
    expect(files?.length).toBeGreaterThan(0);
  }, 200000);
}

afterAll(async () => {
  await server.destroy();
}, 100000);
