import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
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
} from '@vendure/testing';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { XeroPlugin } from '../src';
import { XeroService } from '../src/services/xero.service';
import gql from 'graphql-tag';
import { testPaymentMethod } from '../../test/src/test-payment-method';

(async () => {
  require('dotenv').config();
  const { testConfig } = require('@vendure/testing');
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminApiPlayground: {},
      shopApiPlayground: {},
    },
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
    plugins: [
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        // app: compileUiExtensions({
        //   outputPath: path.join(__dirname, '__admin-ui'),
        //   extensions: [],
        //   devMode: true,
        // }),
      }),
      XeroPlugin,
    ],
  });
  const { server, shopClient, adminClient } = createTestEnvironment(config);
  await server.init({
    initialData: {
      ...initialData,
      paymentMethods: [
        {
          name: testPaymentMethod.code,
          handler: { code: testPaymentMethod.code, arguments: [] },
        },
      ],
    },
    productsCsvPath: '../test/src/products-import.csv',
  });

  await createSettledOrder(shopClient, 1);

  await adminClient.asSuperAdmin();
  const result = await adminClient.query(gql`
    mutation {
      sendOrdersToXero(orderIds: [1])
    }
      `);
    console.log(result);
})();
