import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  AutoIncrementIdStrategy,
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import gql from 'graphql-tag';
import path from 'path';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { LimitedProductsPlugin } from '../src';
import '../src/types';

require('dotenv').config();

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      LimitedProductsPlugin,
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, './__admin-ui'),
          extensions: [LimitedProductsPlugin.uiExtensions],
          devMode: true,
        }),
      }),
    ],
    apiOptions: {
      shopApiPlayground: true,
      adminApiPlayground: true,
    },
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
    entityOptions: {
      entityIdStrategy: new AutoIncrementIdStrategy(),
    },
  });
  const { server, adminClient, shopClient } = createTestEnvironment(devConfig);
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

  //Set max per order
  await adminClient.asSuperAdmin();
  const {
    updateProduct
  } = await adminClient.query(
    gql`
      mutation updateProduct(
        $onlyAllowPer: [String!]
      ) {
        updateProduct(
          input: 
            {
              id: "1"
              customFields: {
                onlyAllowPer: $onlyAllowPer
              }
            }
        ) {
          ... on Product {
            customFields {
              maxPerOrder
              onlyAllowPer
            }
          }
        }
      }
    `,
    {
      onlyAllowPer: [
        JSON.stringify({ channelId: '1', value: 2 }),
      ],
    }
  );
})();
