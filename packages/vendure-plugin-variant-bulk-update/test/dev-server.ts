import { initialData } from '../../test/src/initial-data';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { VariantBulkUpdatePlugin } from '../src/variant-bulk-update.plugin';

require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminApiPlayground: {},
    },
    customFields: {
      Product: [
        {
          name: 'unavailable',
          type: 'boolean',
        },
      ],
      ProductVariant: [
        {
          name: 'unavailable',
          type: 'boolean',
        },
      ],
    },
    plugins: [
      VariantBulkUpdatePlugin.init({
        enablePriceBulkUpdate: true,
        bulkUpdateCustomFields: ['unavailable'],
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
      }),
    ],
  });
  const { server, adminClient, shopClient } = createTestEnvironment(devConfig);
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
})();
