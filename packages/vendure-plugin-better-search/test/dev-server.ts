import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import {
  SqljsInitializer,
  createTestEnvironment,
  registerInitializer,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import dotenv from 'dotenv';
import {
  BetterSearchPlugin,
  BetterSearchResult,
  defaultSearchConfig,
  SearchPluginInitOptions,
} from '../src';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { searchConfig } from './search-config';

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
    plugins: [
      BetterSearchPlugin.init(searchConfig),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
      }),
    ],
  });
  const { server } = createTestEnvironment(config);
  await server.init({
    initialData,
    productsCsvPath: './test/search-products.csv',
  });
})();
