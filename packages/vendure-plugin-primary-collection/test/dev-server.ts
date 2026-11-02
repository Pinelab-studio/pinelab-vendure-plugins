import {
  AutoIncrementIdStrategy,
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { PrimaryCollectionPlugin } from '../src/primary-collection-plugin';
import { initialTestData } from './initial-test-data';

require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [PrimaryCollectionPlugin, DefaultSearchPlugin],
    apiOptions: {
      shopApiPlayground: true,
      adminApiPlayground: true,
    },
    entityOptions: {
      entityIdStrategy: new AutoIncrementIdStrategy(),
    },
  });
  const { server, adminClient, shopClient } = createTestEnvironment(devConfig);
  await server.init({
    initialData: initialTestData,
    productsCsvPath: './test/products.csv',
  });
})();
