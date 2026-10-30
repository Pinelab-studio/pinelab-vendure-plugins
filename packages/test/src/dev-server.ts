import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import dotenv from 'dotenv';
import { initialData } from './initial-data';
import { testPaymentMethod } from './test-payment-method';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  dotenv.config();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { testConfig } = require('@vendure/testing');
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminApiPlayground: {},
      shopApiPlayground: {},
    },
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
    plugins: [],
  });
  const { server } = createTestEnvironment(config);
  await server.init({
    initialData,
    productsCsvPath: './src/products-import.csv',
  });
})();
