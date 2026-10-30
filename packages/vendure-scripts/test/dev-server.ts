import { DefaultSearchPlugin, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  E2E_DEFAULT_CHANNEL_TOKEN,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  TestServer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { populateEuZonesAndTaxRates } from '../src';

(async () => {
  let server: TestServer;
  let _adminClient: SimpleGraphQLClient;
  let _shopClient: SimpleGraphQLClient;

  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: console,
    apiOptions: {
      port: 3050,
    },
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
    plugins: [DefaultSearchPlugin],
  });

  ({ server, _adminClient, _shopClient } = createTestEnvironment(config));
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
    E2E_DEFAULT_CHANNEL_TOKEN,
  );
})();
