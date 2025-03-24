import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import {
  AutoIncrementIdStrategy,
  DefaultLogger,
  DefaultSearchPlugin,
  LanguageCode,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import { initialData } from '../../test/src/initial-data';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { ShippingExtensionsPlugin } from '../src/shipping-extensions.plugin';
import { UKPostalCodeToGelocationConversionStrategy } from '../src/strategies/uk-postalcode-to-geolocation-strategy';

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
    entityOptions: {
      entityIdStrategy: new AutoIncrementIdStrategy(),
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
        // app: compileUiExtensions({
        //   outputPath: path.join(__dirname, '__admin-ui'),
        //   extensions: [ShippingExtensionsPlugin.ui],
        //   devMode: true,
        // }),
      }),
      ShippingExtensionsPlugin.init({
        weightUnit: 'kg',
        customFieldsTab: 'Physical properties',
        orderAddressToGeolocationStrategy:
          new UKPostalCodeToGelocationConversionStrategy(),
      }),
    ],
  });
  const { server, shopClient } = createTestEnvironment(config);
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
})();
