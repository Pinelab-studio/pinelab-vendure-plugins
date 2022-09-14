import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LanguageCode,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import { initialData } from '../../test/src/initial-data';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { ShippingByWeightAndCountryPlugin } from '../src/shipping-by-weight-and-country.plugin';

(async () => {
  require('dotenv').config();
  const { testConfig } = require('@vendure/testing');
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    dbConnectionOptions: {
      synchronize: true,
    },
    apiOptions: {
      adminApiPlayground: {},
      shopApiPlayground: {},
    },
    customFields: {
      Product: [
        {
          name: 'width',
          label: [{ value: 'Width', languageCode: LanguageCode.en }],
          type: 'localeString',
          ui: { component: 'text-form-input', tab: 'Physical properties' },
        },
        {
          name: 'metaTitle',
          label: [{ value: 'Meta title', languageCode: LanguageCode.en }],
          type: 'localeString',
          ui: { component: 'text-form-input', tab: 'SEO' },
        },
      ],
    },
    plugins: [
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
      }),
      ShippingByWeightAndCountryPlugin.init({
        weightUnit: 'kg',
        customFieldsTab: 'Physical properties',
      }),
    ],
  });
  const { server, shopClient } = createTestEnvironment(config);
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
})();
