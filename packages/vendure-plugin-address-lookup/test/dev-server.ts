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
import { initialData } from '../../test/src/initial-data';
import { AddressLookupPlugin } from '../src/address-lookup.plugin';
import {
  GooglePlacesLookupStrategy,
  PostNLLookupStrategy,
  PostcodeTechStrategy,
} from '../src';

require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    authOptions: {
      tokenMethod: ['bearer', 'cookie'],
    },
    plugins: [
      AddressLookupPlugin.init({
        lookupStrategies: [
          new PostNLLookupStrategy({
            apiKey: process.env.POSTNL_APIKEY!,
          }),
          new PostcodeTechStrategy({
            apiKey: process.env.POSTCODE_TECH_APIKEY!,
          }),
          new GooglePlacesLookupStrategy({
            apiKey: process.env.GOOGLE_PLACES_APIKEY!,
            supportedCountryCodes: ['DE'],
          }),
        ],
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
      }),
    ],
    apiOptions: {
      shopApiPlayground: true,
      adminApiPlayground: true,
    },
  });

  const { server } = createTestEnvironment(config);
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
})().catch((err) => {
  console.error(err);
});
