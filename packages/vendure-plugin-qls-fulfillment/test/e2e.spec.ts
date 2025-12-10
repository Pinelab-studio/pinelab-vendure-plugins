import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import { beforeAll, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { QlsPlugin } from '../src';
import { testPaymentMethod } from '../../test/src/test-payment-method';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;
let serverStarted = false;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      QlsPlugin.init({
        getConfig: () => {
          return undefined;
        },
        getAdditionalVariantFields: (ctx, variant) => ({
          ean: variant.sku,
        }),
        webhookSecret: '121231',
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
}, 60000);

it('Should start successfully', async () => {
  expect(serverStarted).toBe(true);
});

// FIXME implement tests

// Trigger full sync via mutation

// Create new product in Vendure

// Update product name in Vendure

// Update stock via webhook

// Test error logs for failed webhook

// Does not update stock when disableStockSync is true

// Tests additional EANs

// Test excludeVariantFromSync

// Test if additional order fields receives all relations (shippingLines, discounts, etc.)

// FIXME Sync button in product overview
//
// if (process.env.TEST_ADMIN_UI) {
//   it('Should compile admin', async () => {
//     const files = await getFilesInAdminUiFolder(
//       __dirname,
//       TEMPLATEPlugin.ui
//     );
//     expect(files?.length).toBeGreaterThan(0);
//   }, 200000);
// }
