import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  TestServer,
  testConfig,
} from '@vendure/testing';
import { beforeAll, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { TEMPLATEPlugin } from '../src';

let server: TestServer;
let _adminClient: SimpleGraphQLClient;
let _shopClient: SimpleGraphQLClient;
let serverStarted = false;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      TEMPLATEPlugin.init({
        // FIXME
        sampleOption: true,
      }),
    ],
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
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
  });
  serverStarted = true;
}, 60000);

it('Should start successfully', async () => {
  expect(serverStarted).toBe(true);
});

// FIXME implement tests
