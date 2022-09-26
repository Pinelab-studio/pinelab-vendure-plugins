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
import { Fulfillment } from '@vendure/common/lib/generated-types';
import gql from 'graphql-tag';
import {
  getCouponCodes,
  getNrOfOrders,
  ParcelInputItem,
  SendcloudPlugin,
} from '../src';

describe('SendCloud', () => {
  let shopClient: SimpleGraphQLClient;
  let adminClient: SimpleGraphQLClient;
  let server: TestServer;
  let fulfillment: Fulfillment;
  let orderId: string;
  /*  nock("https://api.myparcel.nl/")
      .persist()
      .post("/webhook_subscriptions", (reqBody) => {
        body = reqBody;
        return true;
      })
      .matchHeader("Content-Type", (val) => {
        contentType = val;
        return true;
      })
      .reply(200, myparcelRes);*/

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const devConfig = mergeConfig(testConfig, {
      apiOptions: {
        port: 3051,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        SendcloudPlugin.init({
          additionalParcelItemsFn: async (ctx, injector, order) => {
            const additionalInputs: ParcelInputItem[] = [];
            additionalInputs.push(await getNrOfOrders(ctx, injector, order));
            const coupons = getCouponCodes(order);
            if (coupons) {
              additionalInputs.push(coupons);
            }
            return additionalInputs;
          },
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

  it('Fails to update SendCloud config without permission', async () => {});

  it('Updates SendCloud permission as superadmin', async () => {});

  it('Autofulfills order when it has Sendcloud handler', async () => {});

  it('Sends order to Sendcloud on order placement with custom parcel properties', async () => {});
});
