/* eslint-disable */
import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import { MolliePlugin } from '@vendure/payments-plugin/package/mollie/mollie.plugin';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { initialData } from './initial-data';
(async () => {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  const serverStarted = false;

  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminApiPlayground: true,
      shopApiPlayground: true,
    },
    plugins: [
      MolliePlugin.init({
        vendureHost: 'my-vendure.io',
        useDynamicRedirectUrl: true,
      }),
    ],
  });

  ({ server, adminClient, shopClient } = createTestEnvironment(config));
  await server.init({
    initialData,
    productsCsvPath: 'test/product-import.csv',
  });
})().catch((err) => {
  console.error(err);
});
