import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import { DefaultLogger, Injector, LogLevel, mergeConfig } from '@vendure/core';
import { ModuleRef } from '@nestjs/core';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { initialData } from '../../test/src/initial-data';
import {
  fulfillSettledOrdersTask,
  getNrOfOrders,
  ParcelInput,
  ParcelInputItem,
  sendcloudHandler,
  SendcloudPlugin,
} from '../src';
import { getSendCloudConfig, updateSendCloudConfig } from './test.helpers';
import { addShippingMethod, getOrder } from '../../test/src/admin-utils';
import { createSettledOrder } from '../../test/src/shop-utils';
import nock from 'nock';
import { expect, describe, beforeAll, afterAll, it } from 'vitest';
import getFilesInAdminUiFolder from '../../test/src/compile-admin-ui.util';

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
      parcel: { id: 'test-id' },
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

  it('Syncs order to SendCloud after placement without fulfilling', async () => {
    const { id } = await createSettledOrder(shopClient, 1);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const order = await getOrder(adminClient, String(id));
    orderCode = order?.code;
    orderId = order?.id;
    // Verify parcel was sent to SendCloud with correct data
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
    // Order should remain in PaymentSettled (no automatic fulfillment)
    expect(order?.state).toBe('PaymentSettled');
  });

  it('Fulfills settled orders to Delivered via scheduled task', async () => {
    const injector = new Injector(server.app.get(ModuleRef));
    const result = await fulfillSettledOrdersTask.execute(injector);
    expect(result.fulfilled).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBe(0);
    const order = await getOrder(adminClient, String(orderId));
    expect(order?.state).toBe('Delivered');
  });

  if (process.env.TEST_ADMIN_UI) {
    it('Should compile admin', async () => {
      const files = await getFilesInAdminUiFolder(
        __dirname,
        SendcloudPlugin.ui
      );
      expect(files?.length).toBeGreaterThan(0);
    }, 200000);
  }

  afterAll(async () => {
    await server.destroy();
  }, 100000);
});
