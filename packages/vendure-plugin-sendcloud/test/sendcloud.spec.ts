import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import {
  DeepPartial,
  DefaultLogger,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { initialData } from '../../test/src/initial-data';
import {
  getNrOfOrders,
  IncomingWebhookBody,
  ParcelInput,
  ParcelInputItem,
  sendcloudHandler,
  SendcloudPlugin,
} from '../src';
import { getSendCloudConfig, updateSendCloudConfig } from './test.helpers';
import { addShippingMethod, getOrder } from '../../test/src/admin-utils';
import { createSettledOrder } from '../../test/src/shop-utils';
import nock from 'nock';
import { SendcloudClient } from '../src/api/sendcloud.client';
import { expect, describe, beforeAll, afterAll, it } from 'vitest';
import crypto from 'crypto';

describe('SendCloud', () => {
  let shopClient: SimpleGraphQLClient;
  let adminClient: SimpleGraphQLClient;
  let server: TestServer;
  let orderCode: string | undefined;
  let orderId: string | undefined;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const devConfig = mergeConfig(testConfig, {
      apiOptions: {
        port: 3050,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        SendcloudPlugin.init({
          weightFn: (line) =>
            (line.productVariant.product?.customFields as any)?.weight || 5,
          hsCodeFn: (line) =>
            (line.productVariant.product?.customFields as any)?.hsCode ||
            'test hs',
          originCountryFn: (line) => 'NL',
          additionalParcelItemsFn: async (ctx, injector, order) => {
            const additionalInputs: ParcelInputItem[] = [
              {
                sku: 'additional',
                weight: '0.1',
                description: 'Nr of orders for this customer',
                quantity: 1,
                value: '12',
              },
            ];
            additionalInputs.push(await getNrOfOrders(ctx, injector, order));
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

  let authHeader: any | undefined;
  let body: { parcel: ParcelInput } | undefined;
  nock('https://panel.sendcloud.sc')
    .persist()
    .post('/api/v2/parcels', (reqBody) => {
      body = reqBody;
      return true;
    })
    .matchHeader('Authorization', (val) => {
      authHeader = val;
      return true;
    })
    .reply(200, {
      parcel: { id: 'test-id', tracking_number: 'test-tracking' },
    });

  it('Creates shippingmethod with Sendcloud handler', async () => {
    await addShippingMethod(adminClient, sendcloudHandler.code);
  });

  it('Fails to update SendCloud config without permission', async () => {
    await adminClient.asAnonymousUser();
    await expect(
      updateSendCloudConfig(
        adminClient,
        'test-secret',
        'test-public',
        '06123456789'
      )
    ).rejects.toThrow('authorized');
  });

  it('Updates SendCloudConfig as superadmin', async () => {
    await adminClient.asSuperAdmin();
    await updateSendCloudConfig(
      adminClient,
      'test-secret',
      'test-public',
      '06123456789'
    );
    const config = await getSendCloudConfig(adminClient);
    expect(config.secret).toBe('test-secret');
    expect(config.publicKey).toBe('test-public');
    expect(config.defaultPhoneNr).toBe('06123456789');
    expect(config.id).toBeDefined();
  });

  it('Syncs order after placement when it has Sendcloud handler', async () => {
    const { id } = await createSettledOrder(shopClient, 1);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const order = await getOrder(adminClient, String(id));
    orderCode = order?.code;
    orderId = order?.id;
    expect(
      body?.parcel.parcel_items.find((i) => i.sku === 'additional')
    ).toBeDefined();
    expect(
      body?.parcel.parcel_items.find((i) => i.weight === '5.000')
    ).toBeDefined();
    expect(
      body?.parcel.parcel_items.find((i) => i.origin_country === 'NL')
    ).toBeDefined();
    expect(
      body?.parcel.parcel_items.find((i) => i.hs_code === 'test hs')
    ).toBeDefined();
    expect(
      body?.parcel.parcel_items.find((item) => item.sku === 'L2201308')?.value
    ).toBe('1558.80');
    expect(
      body?.parcel.parcel_items.find((item) => item.sku === 'L2201508')?.value
    ).toBe('1678.80');
    expect(authHeader?.[0]).toContain('Basic');
    expect(body?.parcel.shipping_method_checkout_name).toContain(
      'test-shipping-method'
    );
    expect(body?.parcel.telephone).toContain('029 1203 1336');
    expect(body?.parcel.email).toContain('hayden.zieme12@hotmail.com');
  });

  it('Updates order to Shipped via webhook', async () => {
    const body: DeepPartial<IncomingWebhookBody> = {
      action: 'parcel_status_changed',
      parcel: {
        order_number: orderCode,
        tracking_number: 'test-tracking',
        status: {
          id: 62990,
          message: 'At sorting centre',
        },
      },
    };
    const signature = crypto
      .createHmac('sha256', 'test-secret')
      .update(JSON.stringify(body))
      .digest('hex');
    await adminClient.fetch(
      'http://localhost:3050/sendcloud/webhook/e2e-default-channel',
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { [SendcloudClient.signatureHeader]: signature },
      }
    );
    const order = await getOrder(adminClient, String(orderId));
    expect(order?.state).toBe('Shipped');
  });

  it('Updates order to Delivered via webhook', async () => {
    const body: DeepPartial<IncomingWebhookBody> = {
      action: 'parcel_status_changed',
      parcel: {
        order_number: orderCode,
        tracking_number: 'test-tracking',
        status: {
          id: 11,
          message: 'Delivered',
        },
      },
    };
    const signature = crypto
      .createHmac('sha256', 'test-secret')
      .update(JSON.stringify(body))
      .digest('hex');
    await adminClient.fetch(
      'http://localhost:3050/sendcloud/webhook/e2e-default-channel',
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { [SendcloudClient.signatureHeader]: signature },
      }
    );
    const order = await getOrder(adminClient, String(orderId));
    const fulfilment = order?.fulfillments?.[0];
    expect(order?.state).toBe('Delivered');
    expect(fulfilment?.trackingCode).toBe('test-tracking');
  });
});
