require('dotenv').config();
import { devConfig } from './dev-config';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { DefaultSearchPlugin, InitialData } from '@vendure/core';
import { initialData } from '../../test/initialData';

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  devConfig.plugins.push(DefaultSearchPlugin);
  devConfig.apiOptions.shopApiPlayground = {};
  const { server } = createTestEnvironment(devConfig);
  await server.init({
    initialData: initialData as InitialData,
    productsCsvPath: '../test/products-import.csv',
  });
})();
