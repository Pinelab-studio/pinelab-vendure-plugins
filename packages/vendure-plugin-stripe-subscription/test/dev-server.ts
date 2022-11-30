import { initialData } from '../../test/src/initial-data';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import gql from 'graphql-tag';
import { stripeSubscriptionHandler } from '../src/stripe-subscription.handler';
import localtunnel from 'localtunnel';

export const CREATE_PAYMENT_METHOD = gql`
  mutation CreatePaymentMethod($input: CreatePaymentMethodInput!) {
    createPaymentMethod(input: $input) {
      id
    }
  }
`;

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
    plugins: [
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
      }),
    ],
  });
  const tunnel = await localtunnel({ port: 3050 });
  const { server, shopClient, adminClient } = createTestEnvironment(config);
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
  // Create method
  await adminClient.query(CREATE_PAYMENT_METHOD, {
    input: {
      code: 'mollie',
      name: 'Mollie payment test',
      description: 'This is a Mollie test payment method',
      enabled: true,
      handler: {
        code: stripeSubscriptionHandler.code,
        arguments: [
          {
            name: 'redirectUrl',
            value: `${tunnel.url}/admin/orders?filter=open&page=1`,
          },
          { name: 'apiKey', value: process.env.STRIPE_APIKEY! },
        ],
      },
    },
  });
})();
