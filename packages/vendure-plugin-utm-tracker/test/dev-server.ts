import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { VendureConfig } from '@vendure/core';
import { initialData } from '../../test/src/initial-data';
import gql from 'graphql-tag';
import { addItem, createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { config } from './vendure-config';

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  // Override cors after merge, because testConfig sets cors: true (boolean)
  // which mergeConfig can't properly replace with an object
  config.apiOptions.cors = {
    origin: 'http://localhost:5173',
    credentials: true,
  };

  const { server, shopClient } = createTestEnvironment(
    config as Required<VendureConfig>
  );
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
        {
          connectedAt: new Date(),
          source: 'klaviyo',
          medium: 'email',
          campaign: 'Monthly newsletter',
        },
        {
          connectedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          source: 'google',
          medium: 'cpc',
          campaign: 'Performance Max Campaign',
        },
        {
          connectedAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
          source: 'klaviyo',
          medium: 'email',
          campaign: 'Abandoned cart reminder',
        },
        {
          connectedAt: new Date('2023-01-01'),
          source: 'google',
          medium: 'cpc',
          campaign: 'Branded campaign',
        },
      ],
    }
  );
  // Settle the order
  const order = await createSettledOrder(shopClient, 1, false);
  // eslint-disable-next-line no-console
  console.log('Order settled with UTM parameters:', order.code);
})();
