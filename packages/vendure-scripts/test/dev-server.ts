import { DefaultSearchPlugin, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  E2E_DEFAULT_CHANNEL_TOKEN,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { initialData } from '../../test/src/initial-data';
import { populateEuZonesAndTaxRates } from '../src';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { EBoekhoudenResolver } from '../../vendure-plugin-e-boekhouden/src/api/e-boekhouden.resolver';

(async () => {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;

  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: console,
    apiOptions: {
      port: 3050,
    },
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
    plugins: [
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
      }),
    ],
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
    customerCount: 5,
  });

  await populateEuZonesAndTaxRates(
    server.app,
    { standard: 1, reduced: 2, zero: 3 },
    E2E_DEFAULT_CHANNEL_TOKEN
  );
})();
