import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { initialData } from '../../test/src/initial-data';
import {
  addItem,
  addPaymentToOrder,
  proceedToArrangingPayment,
} from '../../test/src/shop-utils';
import {
  addShippingMethod,
  fulfill,
  getOrder,
} from '../../test/src/admin-utils';
import nock from 'nock';
import { Fulfillment } from '@vendure/common/lib/generated-types';
import fs from 'fs';
import path from 'path';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import gql from 'graphql-tag';

const apiKey = 'test-api-key';

describe('MyParcel', () => {
  let shopClient: SimpleGraphQLClient;
  let adminClient: SimpleGraphQLClient;
  let server: TestServer;
  let fulfillment: Fulfillment;
  let orderId: string;
  // This interceptor needs to be in place before startup
  nock('https://api.myparcel.nl/')
    .persist()
    .post('/webhook_subscriptions', (reqBody) => {
      body = reqBody;
      return true;
    })
    .matchHeader('Content-Type', (val) => {
      contentType = val;
      return true;
    })
    .reply(200, myparcelRes);

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const devConfig = mergeConfig(testConfig, {
      apiOptions: {
        port: 3051,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        MyparcelPlugin.init({
          vendureHost: 'https://test-webhook.com',
        }),
      ],
      paymentOptions: {
        paymentMethodHandlers: [testPaymentMethod],
      },
    });
    const env = createTestEnvironment(devConfig);
    shopClient = env.shopClient;
    adminClient = env.adminClient;
    server = env.server;
    await server.init({
      initialData: {
        ...initialData,
        shippingMethods: [],
        paymentMethods: [
          {
            name: testPaymentMethod.code,
            handler: { code: testPaymentMethod.code, arguments: [] },
          },
        ],
      },
      productsCsvPath: '../test/src/products-import.csv',
      customerCount: 2,
    });
  }, 60000);

  afterAll(async () => {
    await server.destroy();
  });

  it('Creates shippingmethod with Sendcloud handler', async () => {});

  it('Sends order to Sendcloud on order placement with custom parcel properties', async () => {});
});

const CREATE_SHIPPING_METHOD = gql`
  mutation CreateShippingMethod($input: CreateShippingMethodInput!) {
    createShippingMethod(input: $input) {
      ... on ShippingMethod {
        id
        code
      }
      __typename
    }
  }
`;

async function createShippingMethod(
  adminClient: SimpleGraphQLClient,
  options: Options
) {
  const res = await adminClient.query(CREATE_SHIPPING_METHOD, {
    input: {
      code: 'shipping-by-weight-and-country',
      checker: {
        code: 'shipping-by-weight-and-country',
        arguments: [
          {
            name: 'minWeight',
            value: String(options.minWeight),
          },
          {
            name: 'maxWeight',
            value: String(options.maxWeight),
          },
          {
            name: 'countries',
            value: JSON.stringify(options.countries),
          },
          {
            name: 'excludeCountries',
            value: String(options.exclude),
          },
        ],
      },
      calculator: {
        code: 'default-shipping-calculator',
        arguments: [
          {
            name: 'rate',
            value: String(options.rate),
          },
          {
            name: 'includesTax',
            value: 'exclude',
          },
          {
            name: 'taxRate',
            value: '0',
          },
        ],
      },
      fulfillmentHandler: 'manual-fulfillment',
      customFields: {},
      translations: [
        {
          languageCode: 'en',
          name: 'Shipping by weight and country',
          description: '',
          customFields: {},
        },
      ],
    },
  });
  return res.createShippingMethod;
}
