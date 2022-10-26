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
import {
  MyparcelService,
  MyparcelShipment,
  MyparcelStatusChangeEvent,
  WebhookSubscription,
} from '../src/api/myparcel.service';
import { Fulfillment } from '@vendure/common/lib/generated-types';
import axios from 'axios';
import { MyparcelPlugin } from '../src';
import { getMyparcelConfig, updateMyparcelConfig } from '../src/ui/queries';
import fs from 'fs';
import path from 'path';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import gql from 'graphql-tag';

type OutgoingMyparcelShipment = { data: { shipments: MyparcelShipment[] } };
type OutgoingWebhookSubscription = {
  data: { webhook_subscriptions: WebhookSubscription[] };
};

const apiKey = 'test-api-key';

describe('MyParcel', () => {
  let shopClient: SimpleGraphQLClient;
  let adminClient: SimpleGraphQLClient;
  let server: TestServer;
  let fulfillment: Fulfillment;
  let orderId: string;
  const address = {
    input: {
      fullName: 'Martinho Pinelabio',
      streetLine1: 'Verzetsstraat',
      streetLine2: '12a',
      city: 'Liwwa',
      postalCode: '8923CP',
      countryCode: 'NL',
    },
  };
  const myparcelRes = {
    data: {
      ids: [
        {
          id: 110913193,
          reference_identifier: 'FOO-222-BAR-42',
        },
      ],
    },
  };
  let contentType: string | undefined;
  let body: OutgoingWebhookSubscription | undefined;
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

  it('Adds apiKey via Graphql mutation', async () => {
    await adminClient.asSuperAdmin();
    const config = await adminClient.query(updateMyparcelConfig, {
      input: { apiKey },
    });
    expect(config.updateMyparcelConfig.apiKey).toEqual(apiKey);
  });

  it('Retrieves apiKey via Graphql query', async () => {
    await adminClient.asSuperAdmin();
    const config = await adminClient.query(getMyparcelConfig);
    expect(config.myparcelConfig.apiKey).toEqual(apiKey);
  });

  it('Created webhook on startup', async () => {
    // Mimic startup again, because real startup didn't have configs in DB populated yet
    await server.app.get(MyparcelService).setWebhooksForAllChannels();
    const webhook = body?.data?.webhook_subscriptions?.[0];
    expect(webhook?.url).toEqual(
      'https://test-webhook.com/myparcel/update-status'
    );
    expect(webhook?.hook).toEqual('shipment_status_change');
    expect(contentType).toEqual('application/json');
  });

  it('Returns drop off points', async () => {
    nock('https://api.myparcel.nl/')
      .get('/drop_off_points?postal_code=8923CP&limit=30&carried_id=1')
      .reply(200, {
        data: {
          drop_off_points: [
            {
              carrier_id: 1,
            },
          ],
        },
      });
    const { myparcelDropOffPoints: res } = await shopClient.query(gql`
      query {
        myparcelDropOffPoints(input: { carrierId: "1", postalCode: "8923CP" }) {
          carrier_id
        }
      }
    `);
    expect(res.length).toEqual(1);
    expect(res?.[0].carrier_id).toEqual(1);
  });

  it('Setup order untill payment', async () => {
    await addShippingMethod(adminClient, 'my-parcel');
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    await addItem(shopClient, 'T_1', 1);
    await addItem(shopClient, 'T_2', 2);
    await proceedToArrangingPayment(shopClient, 3, address);
    const order = await addPaymentToOrder(shopClient, testPaymentMethod.code);
    orderId = (order as any).id;
    expect(shopClient).toBeDefined();
  });

  it('Fulfill order with MyParcel', async () => {
    let body: OutgoingMyparcelShipment | undefined;
    let contentType = undefined;
    nock('https://api.myparcel.nl/')
      .post('/shipments', (reqBody) => {
        body = reqBody;
        return true;
      })
      .matchHeader('Content-Type', (val) => {
        contentType = val;
        return true;
      })
      .reply(200, myparcelRes);
    fulfillment = await fulfill(adminClient, 'my-parcel', [
      ['T_1', 1],
      ['T_2', 2],
    ]);
    const shipment = body?.data?.shipments?.[0];
    expect(fulfillment.state).toEqual('Pending');
    expect(shipment?.carrier).toEqual(1);
    expect(shipment?.recipient.city).toEqual('Liwwa');
    expect(shipment?.recipient.street).toEqual('Verzetsstraat');
    expect(shipment?.recipient.number).toEqual('12');
    expect(shipment?.recipient.number_suffix).toEqual('a');
    expect(shipment?.recipient.postal_code).toEqual('8923CP');
    expect(shipment?.recipient.cc).toEqual('NL');
    expect(contentType).toEqual(
      'application/vnd.shipment+json;version=1.1;charset=utf-8'
    );
  });

  it('Updates to Shipped after status change webhook', async () => {
    await postStatusChange(fulfillment.method, 3);
    const order = await getOrder(adminClient, orderId);
    expect(order?.fulfillments?.[0]?.state).toEqual('Shipped');
  });

  it('Updates to Delivered after status change webhook', async () => {
    await postStatusChange(fulfillment.method, 7);
    const order = await getOrder(adminClient, orderId);
    expect(order?.fulfillments?.[0]?.state).toEqual('Delivered');
  });

  it('Removes apiKey via Graphql mutation', async () => {
    await adminClient.asSuperAdmin();
    const config = await adminClient.query(updateMyparcelConfig, {
      input: { apiKey: undefined },
    });
    expect(config.updateMyparcelConfig).toEqual(null);
  });

  it.skip('Should compile admin', async () => {
    fs.rmSync(path.join(__dirname, '__admin-ui'), {
      recursive: true,
      force: true,
    });
    await compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [MyparcelPlugin.ui],
    }).compile?.();
    const files = fs.readdirSync(path.join(__dirname, '__admin-ui/dist'));
    expect(files?.length).toBeGreaterThan(0);
  }, 240000);
});

export async function postStatusChange(
  fulfillmentReference: string,
  status: number
): Promise<void> {
  const shipmentId = fulfillmentReference.replace(`MyParcel `, '');
  let buff = Buffer.from(apiKey);
  let encodedKey = buff.toString('base64');
  await axios.post(
    'http://localhost:3051/myparcel/update-status',
    <MyparcelStatusChangeEvent>{
      data: {
        hooks: [
          {
            shipment_id: shipmentId,
            status,
          },
        ],
      },
    },
    {
      headers: { 'X-MyParcel-Authorization': encodedKey },
    }
  );
}
