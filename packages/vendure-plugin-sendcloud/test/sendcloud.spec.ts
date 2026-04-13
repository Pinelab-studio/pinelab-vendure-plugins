import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import {
  configureDefaultOrderProcess,
  DefaultLogger,
  Injector,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
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
import {
  addShippingMethod,
  fulfill,
  getOrder,
  updateVariants,
  getAllVariants,
} from '../../test/src/admin-utils';
import { createSettledOrder } from '../../test/src/shop-utils';
import { waitFor } from '../../test/src/test-helpers';
import nock from 'nock';
import gql from 'graphql-tag';
import { expect, describe, beforeAll, afterAll, it } from 'vitest';
import { GlobalFlag } from '../../test/src/generated/admin-graphql';
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
      orderOptions: {
        // Test nightly fulfillment when an order moved to Shipped without fulfillment
        process: [
          configureDefaultOrderProcess({
            checkFulfillmentStates: false,
          }) as any,
        ],
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
    // Enable inventory tracking for the variants used in the tests
    await adminClient.asSuperAdmin();
    await updateVariants(adminClient, [
      { id: 'T_1', trackInventory: GlobalFlag.True },
      { id: 'T_2', trackInventory: GlobalFlag.True },
    ]);
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
    const { id } = await createSettledOrder(shopClient, 1, true, [
      { id: 'T_1', quantity: 1 },
      { id: 'T_2', quantity: 2 },
    ]);
    // Wait for the SendCloud job queue to process the order
    await waitFor(async () => {
      const o = await getOrder(adminClient, String(id));
      return o?.state === 'PaymentSettled' && body?.parcel ? true : undefined;
    });
    const order = await getOrder(adminClient, String(id));
    orderCode = order?.code;
    orderId = order?.id;
    // Allocation should have been created for the ordered lines (before fulfillment)
    await adminClient.asSuperAdmin();
    await waitFor(async () => {
      const variants = await getAllVariants(adminClient);
      for (const l of order!.lines) {
        const v = variants.find((x) => x.id === l.productVariant.id);
        if (!v || v.stockAllocated !== l.quantity) {
          return undefined;
        }
      }
      return true;
    });
    // verify stockOnHand unchanged and stockAllocated matches order line quantities
    const afterAlloc = await getAllVariants(adminClient);
    const v1Alloc = afterAlloc.find((x) => x.sku === 'L2201308')!;
    const v2Alloc = afterAlloc.find((x) => x.sku === 'L2201508')!;
    expect(v1Alloc.stockOnHand).toBe(100);
    expect(v1Alloc.stockAllocated).toBe(1);
    expect(v2Alloc.stockOnHand).toBe(100);
    expect(v2Alloc.stockAllocated).toBe(2);
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
    // Get stock before fulfillment
    await adminClient.asSuperAdmin();
    const variantsBefore = await getAllVariants(adminClient);
    const v1Before = variantsBefore.find((x) => x.sku === 'L2201308')!;
    const v2Before = variantsBefore.find((x) => x.sku === 'L2201508')!;
    expect(v1Before.stockOnHand).toBe(100);
    expect(v1Before.stockAllocated).toBe(1);
    expect(v2Before.stockOnHand).toBe(100);
    expect(v2Before.stockAllocated).toBe(2);
    // Fulfill orders
    const injector = new Injector(server.app.get(ModuleRef));
    const result = await fulfillSettledOrdersTask.execute(injector);
    expect(result.fulfilled).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBe(0);
    const order = await getOrder(adminClient, String(orderId));
    expect(order?.state).toBe('Delivered');
    // After fulfillment the stock should be deducted and allocations cleared for the original order
    const variantsAfter = await getAllVariants(adminClient);
    const v1After = variantsAfter.find((x) => x.sku === 'L2201308')!;
    const v2After = variantsAfter.find((x) => x.sku === 'L2201508')!;
    expect(v1After.stockOnHand).toBe(99);
    expect(v1After.stockAllocated).toBe(0);
    expect(v2After.stockOnHand).toBe(98);
    expect(v2After.stockAllocated).toBe(0);
  });

  it('Delivers order that already has a pending fulfillment via scheduled task', async () => {
    const { id: newId } = await createSettledOrder(shopClient, 1);
    await waitFor(async () => {
      const o = await getOrder(adminClient, String(newId));
      return o?.state === 'PaymentSettled' ? true : undefined;
    });
    const settledOrder = await getOrder(adminClient, String(newId));
    expect(settledOrder?.state).toBe('PaymentSettled');
    // verify allocation exists before creating fulfillment
    await adminClient.asSuperAdmin();
    const afterAlloc = await getAllVariants(adminClient);
    const v1Alloc = afterAlloc.find((x) => x.sku === 'L2201308')!;
    const v2Alloc = afterAlloc.find((x) => x.sku === 'L2201508')!;
    expect(v1Alloc.stockAllocated).toBe(1);
    expect(v2Alloc.stockAllocated).toBe(2);

    // Get stock before fulfillment
    const variantsBefore = await getAllVariants(adminClient);
    const v1Before = variantsBefore.find((x) => x.sku === 'L2201308')!;
    const v2Before = variantsBefore.find((x) => x.sku === 'L2201508')!;
    expect(v1Before.stockOnHand).toBe(99);
    expect(v2Before.stockOnHand).toBe(98);

    // Manually create a fulfillment: order moves to Fulfilled, fulfillment starts in Pending
    await fulfill(
      adminClient,
      sendcloudHandler.code,
      settledOrder!.lines.map((l) => [l.id, l.quantity] as [string, number]),
      []
    );
    const fulfilledOrder = await getOrder(adminClient, String(newId));
    expect(fulfilledOrder?.state).toBe('PaymentSettled');
    // Run the task: should pick up the Fulfilled order and transition its pending fulfillment to Delivered
    const injector = new Injector(server.app.get(ModuleRef));
    const result = await fulfillSettledOrdersTask.execute(injector);
    expect(result.failed).toBe(0);
    const deliveredOrder = await getOrder(adminClient, String(newId));
    expect(deliveredOrder?.state).toBe('Delivered');
    // After fulfillment the stock should be deducted and allocations cleared for this order
    const variantsAfter = await getAllVariants(adminClient);
    const v1After = variantsAfter.find((x) => x.sku === 'L2201308')!;
    const v2After = variantsAfter.find((x) => x.sku === 'L2201508')!;
    expect(v1After.stockAllocated).toBe(0);
    expect(v1After.stockOnHand).toBe(98);
    expect(v2After.stockAllocated).toBe(0);
    expect(v2After.stockOnHand).toBe(96);
  });

  it('Delivers a Shipped order (without fulfillment) via scheduled task', async () => {
    const { id: newId } = await createSettledOrder(shopClient, 1);
    await waitFor(async () => {
      const o = await getOrder(adminClient, String(newId));
      return o?.state === 'PaymentSettled' ? true : undefined;
    });
    const settledOrder = await getOrder(adminClient, String(newId));
    expect(settledOrder?.state).toBe('PaymentSettled');
    // allocation should exist before transitioning to Shipped
    await adminClient.asSuperAdmin();
    const beforeFulfillment = await getAllVariants(adminClient);
    const v1Before = beforeFulfillment.find((x) => x.sku === 'L2201308')!;
    const v2Before = beforeFulfillment.find((x) => x.sku === 'L2201508')!;
    expect(v1Before.stockOnHand).toBe(98);
    expect(v1Before.stockAllocated).toBe(1);
    expect(v2Before.stockOnHand).toBe(96);
    expect(v2Before.stockAllocated).toBe(2);
    // Transition the order to Shipped without creating a fulfillment (checkFulfillmentStates: false)
    const { transitionOrderToState } = await adminClient.query(
      gql`
        mutation TransitionOrderToState($id: ID!, $state: String!) {
          transitionOrderToState(id: $id, state: $state) {
            ... on Order {
              id
              state
            }
            ... on OrderStateTransitionError {
              errorCode
              transitionError
            }
          }
        }
      `,
      { id: settledOrder!.id, state: 'Shipped' }
    );
    expect(transitionOrderToState.state).toBe('Shipped');
    // Run the task: should detect the Shipped order with no fulfillment and transition directly to Delivered
    const injector = new Injector(server.app.get(ModuleRef));
    const result = await fulfillSettledOrdersTask.execute(injector);
    expect(result.fulfilled).toBe(1);
    const deliveredOrder = await getOrder(adminClient, String(newId));
    expect(deliveredOrder?.state).toBe('Delivered');
    // After delivery, ensure allocations cleared and stock decreased
    await adminClient.asSuperAdmin();
    const variantsAfter = await getAllVariants(adminClient);
    const v1After = variantsAfter.find((x) => x.sku === 'L2201308')!;
    const v2After = variantsAfter.find((x) => x.sku === 'L2201508')!;
    expect(v1After.stockAllocated).toBe(0);
    expect(v1After.stockOnHand).toBe(97);
    expect(v2After.stockAllocated).toBe(0);
    expect(v2After.stockOnHand).toBe(94);
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
