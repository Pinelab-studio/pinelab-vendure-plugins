import {
  DefaultLogger,
  LogLevel,
  mergeConfig,
  LanguageCode,
  DefaultSearchPlugin,
} from '@vendure/core';
import {
  SqljsInitializer,
  createTestEnvironment,
  registerInitializer,
  testConfig,
} from '@vendure/testing';
import dotenv from 'dotenv';
import { initialData } from '../../test/src/initial-data';
import { buyMinMaxOfTheSpecifiedProductsCondition } from '../src';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  dotenv.config();
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminApiPlayground: {},
      shopApiPlayground: {},
    },
    plugins: [
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
      }),
    ],
    promotionOptions: {
      promotionConditions: [buyMinMaxOfTheSpecifiedProductsCondition],
    },
  });
  const { server } = createTestEnvironment(config);
  await server.init({
    initialData: {
      ...initialData,
    },
    productsCsvPath: '../test/src/products-import.csv',
  });
})();
