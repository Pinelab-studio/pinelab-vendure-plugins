require('dotenv').config();
import { devConfig } from './dev-config';
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
  devConfig.plugins.push(AdminUiPlugin.init({ port: 3002, route: 'admin' }));

  const { server } = createTestEnvironment(devConfig);
  await server.init({
    initialData: {
      ...initialData,
      paymentMethods: [
        {
          name: 'mollie-payment',
          handler: {
            code: 'mollie-payment-handler',
            arguments: [
              { name: 'apiKey', value: process.env.apiKey! },
              { name: 'redirectUrl', value: process.env.redirectUrl! },
            ],
          },
        },
      ],
    },
    productsCsvPath: '../test/products-import.csv',
  });
})();
