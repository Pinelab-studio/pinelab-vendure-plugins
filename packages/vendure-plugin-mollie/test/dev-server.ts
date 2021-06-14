require('dotenv').config();
import { MolliePlugin } from '../src';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import {
  DefaultLogger,
  InitialData,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import { initialData } from '../../test/initialData';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';

(async () => {
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [MolliePlugin, AdminUiPlugin.init({ port: 3002, route: 'admin' })],
  });
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const { server } = createTestEnvironment(config);
  await server.init({
    initialData: {
      ...initialData,
      paymentMethods: [
        {
          name: 'mollie-payment',
          handler: {
            code: 'mollie-payment-handler',
            arguments: [
              { name: 'apiKey', value: process.env.apiKey! },
              { name: 'redirectUrl', value: process.env.redirectUrl! },
            ],
          },
        },
      ],
    } as InitialData,
    productsCsvPath: '../test/products-import.csv',
  });
})();
