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
import { UTMTrackerPlugin } from '../src/utm-tracker.plugin';
import path from 'path';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import { LinearAttribution } from '../src';
import gql from 'graphql-tag';
import { addItem, createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/dist/test-payment-method';

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
    dbConnectionOptions: {
      autoSave: true,
    },
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
    plugins: [
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [UTMTrackerPlugin.ui],
          devMode: true,
        }),
      }),
      UTMTrackerPlugin.init({
        attributionModel: new LinearAttribution(),
        maxParametersPerOrder: 5,
        maxAttributionAgeInDays: 30,
      }),
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

  // Create an active order, add UTM parameters, and settle the order
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  await addItem(shopClient, 'T_1', 1);

  // Add two UTM parameters
  await shopClient.query(
    gql`
      mutation addUTMParametersToOrder($inputs: [UTMParameterInput!]!) {
        addUTMParametersToOrder(inputs: $inputs)
      }
    `,
    {
      inputs: [
        { connectedAt: new Date(), source: 'dev-source1' },
        { connectedAt: new Date(), source: 'dev-source2' },
        { connectedAt: new Date('2023-01-01'), source: 'dev-source3' },
      ],
    }
  );
  // Settle the order
  const order = await createSettledOrder(shopClient, 1, false);
  // eslint-disable-next-line no-console
  console.log('Order settled with UTM parameters:', order.code);
})();
