require('dotenv').config();
import { devConfig } from './sendcloud.dev-config';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { DefaultSearchPlugin } from '@vendure/core';
import { initialData } from '../../test/initialData';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  devConfig.plugins.push(DefaultSearchPlugin);
  devConfig.plugins.push(AdminUiPlugin.init({ port: 3002 }));
  const { server } = createTestEnvironment(devConfig);
  await server.init({
    initialData,
    productsCsvPath: '../test/products-import.csv',
  });
})();
