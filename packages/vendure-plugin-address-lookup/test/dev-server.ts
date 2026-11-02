import {
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
import { initialData } from '../../test/src/initial-data';
import { BAGLookupStrategy, GooglePlacesLookupStrategy } from '../src';
import { AddressLookupPlugin } from '../src/address-lookup.plugin';

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
          // new PostNLLookupStrategy({
          //   apiKey: process.env.POSTNL_APIKEY!,
          // }),
          new BAGLookupStrategy({
            apiKey: process.env.BAG_APIKEY!,
          }),
          new GooglePlacesLookupStrategy({
            apiKey: process.env.GOOGLE_PLACES_APIKEY!,
            supportedCountryCodes: ['DE'],
          }),
        ],
      }),
      DefaultSearchPlugin,
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
