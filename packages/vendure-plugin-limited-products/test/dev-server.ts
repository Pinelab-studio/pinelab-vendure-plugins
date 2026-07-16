import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { VendureConfig } from '@vendure/core';
import gql from 'graphql-tag';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { config } from './vendure-config';
import '../src/types';

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  // Override cors after merge, because testConfig sets cors: true (boolean)
  // which mergeConfig can't properly replace with an object
  config.apiOptions.cors = {
    origin: 'http://localhost:5173',
    credentials: true,
  };

  const { server, adminClient } = createTestEnvironment(
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

  //Set max per order
  await adminClient.asSuperAdmin();
  await adminClient.query(
    gql`
      mutation updateProduct($onlyAllowPer: [String!]) {
        updateProduct(
          input: { id: "1", customFields: { onlyAllowPer: $onlyAllowPer } }
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
      onlyAllowPer: [JSON.stringify({ channelId: '1', value: 2 })],
    }
  );
})();
