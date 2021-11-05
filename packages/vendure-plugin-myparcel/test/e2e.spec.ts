import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import { MyparcelPlugin } from '../src/myparcel.plugin';
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
  MyparcelShipment,
  MyparcelStatusChangeEvent,
  WebhookSubscription,
} from '../src/myparcel.service';
import { Fulfillment } from '@vendure/common/lib/generated-types';
import axios from 'axios';

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
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        MyparcelPlugin.init(
          {
            'e2e-default-channel': apiKey,
          },
          'https://test-webhook.com'
        ),
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
  }, 120000);

  afterAll(async () => {
    await server.destroy();
  });

  it('Created webhook on startup', async () => {
    const webhook = body?.data?.webhook_subscriptions?.[0];
    expect(webhook?.url).toEqual(
      'https://test-webhook.com/myparcel/update-status'
    );
    expect(webhook?.hook).toEqual('shipment_status_change');
    expect(contentType).toEqual('application/json');
  });

  it('Setup order untill payment', async () => {
    await addShippingMethod(adminClient, 'my-parcel');
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    await addItem(shopClient, 'T_1', 1);
    await addItem(shopClient, 'T_2', 2);
    await proceedToArrangingPayment(shopClient, address);
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
});

export async function postStatusChange(
  fulfullmentReference: string,
  status: number
): Promise<void> {
  const shipmentId = fulfullmentReference.replace(`MyParcel `, '');
  let buff = Buffer.from(apiKey);
  let encodedKey = buff.toString('base64');
  await axios.post(
    'http://localhost:3050/myparcel/update-status',
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
