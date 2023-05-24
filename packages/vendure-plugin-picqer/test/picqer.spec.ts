import { DefaultLogger, ID, LogLevel, mergeConfig } from '@vendure/core';
import {
  E2E_DEFAULT_CHANNEL_TOKEN,
  SimpleGraphQLClient,
  SqljsInitializer,
  createTestEnvironment,
  registerInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import nock from 'nock';
import {
  addShippingMethod,
  getAllVariants,
  getOrder,
  updateProduct,
  updateVariants,
} from '../../test/src/admin-utils';
import {
  GetVariantsQuery,
  GlobalFlag,
} from '../../test/src/generated/admin-graphql';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { PicqerPlugin } from '../src';
import { IncomingPicklistWebhook, VatGroup } from '../src/api/types';
import { FULL_SYNC, GET_CONFIG, UPSERT_CONFIG } from '../src/ui/queries';
import { createSignature } from './test-helpers';
import { Order } from '@vendure/core';
import { picqerHandler } from '../src/api/picqer.handler';
import {describe, afterEach, beforeAll, it, expect, afterAll} from 'vitest';


let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;
const nockBaseUrl = 'https://test-picqer.io/api/v1/';


describe('Picqer plugin', function () {
  // Clear nock mocks after each test
  afterEach(() => nock.cleanAll());

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        PicqerPlugin.init({
          enabled: true,
          vendureHost: 'https://example-vendure.io',
          // Dummy data for testing purposes
          pushProductVariantFields: (variant) => ({ barcode: variant.sku }),
          pullPicqerProductFields: (picqerProd) => ({
            outOfStockThreshold: 123,
          }),
          addPicqerOrderNote: (order) => 'test note',
        }),
      ],
      paymentOptions: {
        paymentMethodHandlers: [testPaymentMethod],
      },
      customFields: {
        ProductVariant: [
          {
            name: 'height',
            type: 'int',
            public: true,
          },
        ],
      },
    });

    ({ server, adminClient, shopClient } = createTestEnvironment(config));
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
  }, 60000);

  it('Should start successfully', async () => {
    expect(server.app.getHttpServer).toBeDefined();
  });

  it('Should track inventory of all variants', async () => {
    await adminClient.asSuperAdmin();
    const variants = await updateVariants(adminClient, [
      { id: 'T_1', trackInventory: GlobalFlag.True },
      { id: 'T_2', trackInventory: GlobalFlag.True },
      { id: 'T_3', trackInventory: GlobalFlag.True },
      { id: 'T_4', trackInventory: GlobalFlag.True },
    ]);
    const everyVariantHasStockTracking = variants.every(
      (v) => v!.trackInventory === GlobalFlag.True
    );
    expect(everyVariantHasStockTracking).toBe(true);
  });

  const createdHooks: any[] = [];

  it('Should update Picqer config via admin api', async () => {
    // Mock hooks GET, because webhooks are updated on config save
    nock(nockBaseUrl).get('/hooks').reply(200, []).persist();
    nock(nockBaseUrl)
      .post('/hooks', (reqBody) => {
        createdHooks.push(reqBody);
        return true;
      })
      .reply(200, { idhook: 'mockHookId' })
      .persist();
    await adminClient.asSuperAdmin();
    const { upsertPicqerConfig: config } = await adminClient.query(
      UPSERT_CONFIG,
      {
        input: {
          enabled: true,
          apiKey: 'test-api-key',
          apiEndpoint: 'https://test-picqer.io/',
          storefrontUrl: 'mystore.io',
          supportEmail: 'support@mystore.io',
        },
      }
    );
    await expect(config.enabled).toBe(true);
    await expect(config.apiKey).toBe('test-api-key');
    await expect(config.apiEndpoint).toBe('https://test-picqer.io/');
    await expect(config.storefrontUrl).toBe('mystore.io');
    await expect(config.supportEmail).toBe('support@mystore.io');
  });

  it('Should have created hooks when config was updated', async () => {
    // Expect 1 created hook: stock change
    await expect(createdHooks.length).toBe(2);
    await expect(createdHooks[0].event).toBe('products.free_stock_changed');
    await expect(createdHooks[0].address).toBe(
      `https://example-vendure.io/picqer/hooks/${E2E_DEFAULT_CHANNEL_TOKEN}`
    );
    await expect(createdHooks[0].secret).toBeDefined();
    await expect(createdHooks[0].name).toBeDefined();
    await expect(createdHooks[1].event).toBe('picklists.closed');
  });

  it('Should get Picqer config after upsert', async () => {
    await adminClient.asSuperAdmin();
    const { picqerConfig: config } = await adminClient.query(GET_CONFIG);
    await expect(config.enabled).toBe(true);
    await expect(config.apiKey).toBe('test-api-key');
    await expect(config.apiEndpoint).toBe('https://test-picqer.io/');
    await expect(config.storefrontUrl).toBe('mystore.io');
    await expect(config.supportEmail).toBe('support@mystore.io');
  });

  it('Should create a shipping method with Picqer handler', async () => {
    await addShippingMethod(adminClient, picqerHandler.code, '500');
  });

  let createdOrder: Order;

  it('Should push order to Picqer on order placement', async () => {
    let isOrderInProcessing = false;
    let createdOrderNote = undefined;
    let picqerOrderRequest: any;
    nock(nockBaseUrl)
      .get('/vatgroups') // Mock vatgroups, because it will try to update products
      .reply(200, [{ idvatgroup: 12, percentage: 20 }] as VatGroup[]);
    nock(nockBaseUrl)
      .get(/.products*/) // Mock products, because it will try to update products
      .reply(200, [{ idproduct: 'mockProductId' }])
      .persist();
    nock(nockBaseUrl)
      .get(/.customers*/) // Mock customer, to connect the order to a customer
      .reply(200, [{ idcustomer: 'mockCustomerId' }]);
    nock(nockBaseUrl)
      .put('/products/mockProductId') // Mock product update, because it will try to update products
      .reply(200, { idproduct: 'mockId' })
      .persist();
    nock(nockBaseUrl)
      .post('/orders/', (reqBody) => {
        picqerOrderRequest = reqBody;
        return true;
      })
      .reply(200, { idorder: 'mockOrderId' });
    nock(nockBaseUrl)
      .post('/orders/mockOrderId/process', (reqBody) => {
        isOrderInProcessing = true;
        return true;
      })
      .reply(200, { idordder: 'mockOrderId' });
    nock(nockBaseUrl)
      .post('/orders/mockOrderId/notes', (reqBody) => {
        createdOrderNote = reqBody.note;
        return true;
      })
      .reply(200, { idordder: 'mockOrderId' });
    // Shipping method 3 should be our created Picqer handler method
    createdOrder = await createSettledOrder(shopClient, 3, true, [
      { id: 'T_1', quantity: 3 },
    ]);
    await new Promise((r) => setTimeout(r, 500)); // Wait for job queue to finish
    const variant = (await getAllVariants(adminClient)).find(
      (v) => v.id === 'T_1'
    );
    expect(variant!.stockOnHand).toBe(100);
    expect(variant!.stockAllocated).toBe(3);
    expect(picqerOrderRequest.reference).toBe(createdOrder.code);
    expect(picqerOrderRequest.deliveryname).toBeDefined();
    expect(picqerOrderRequest.deliverycontactname).toBeDefined();
    expect(picqerOrderRequest.deliveryaddress).toBeDefined();
    expect(picqerOrderRequest.deliveryzipcode).toBeDefined();
    expect(picqerOrderRequest.deliverycountry).toBeDefined();
    expect(picqerOrderRequest.products.length).toBe(1);
    expect(picqerOrderRequest.products[0].amount).toBe(3);
    expect(isOrderInProcessing).toBe(true);
    expect(createdOrderNote).toBe('test note');
  });

  // FIXME enable after fix: https://github.com/vendure-ecommerce/vendure/issues/2191
  it.skip('Should update to "PartiallyDelivered" when 2 of 3 items are shipped', async () => {
    const mockIncomingWebhook = {
      event: 'picklists.closed',
      data: {
        reference: createdOrder.code,
        products: [
          { productcode: 'L2201308', amountpicked: 2 }, // Only 2 of 3 are picked
        ],
      },
    } as Partial<IncomingPicklistWebhook>;
    await adminClient.fetch(
      `http://localhost:3050/picqer/hooks/${E2E_DEFAULT_CHANNEL_TOKEN}`,
      {
        method: 'POST',
        body: JSON.stringify(mockIncomingWebhook),
        headers: {
          'X-Picqer-Signature': createSignature(
            mockIncomingWebhook,
            'test-api-key'
          ),
        },
      }
    );
    const order = await getOrder(adminClient, createdOrder.id as string);
    expect(order!.state).toBe('PartiallyDelivered');
  });

  it('Should have updated stock after 1 item was shipped', async () => {
    const variant = (await getAllVariants(adminClient)).find(
      (v) => v.id === 'T_1'
    );
    expect(variant!.stockOnHand).toBe(98);
    expect(variant!.stockAllocated).toBe(1);
  });

  it('Should update to "Delivered" when 3 of 3 items are shipped', async () => {
    const mockIncomingWebhook = {
      event: 'picklists.closed',
      data: {
        reference: createdOrder.code,
        products: [
          { productcode: 'L2201308', amountpicked: 1 }, // last one to complete the order
        ],
      },
    } as Partial<IncomingPicklistWebhook>;
    await adminClient.fetch(
      `http://localhost:3050/picqer/hooks/${E2E_DEFAULT_CHANNEL_TOKEN}`,
      {
        method: 'POST',
        body: JSON.stringify(mockIncomingWebhook),
        headers: {
          'X-Picqer-Signature': createSignature(
            mockIncomingWebhook,
            'test-api-key'
          ),
        },
      }
    );
    const order = await getOrder(adminClient, createdOrder.id as string);
    expect(order!.state).toBe('Delivered');
  });

  it('Should have updated stock after all items are shipped', async () => {
    const variant = (await getAllVariants(adminClient)).find(
      (v) => v.id === 'T_1'
    );
    expect(variant!.stockOnHand).toBe(97);
    expect(variant!.stockAllocated).toBe(0);
  });

  /**
   * Request payloads of products that have been created or updated in Picqer
   */
  let pushProductPayloads: any[] = [];

  it('Should push all products to Picqer on full sync', async () => {
    // Mock vatgroups GET
    nock(nockBaseUrl)
      .get('/vatgroups')
      .reply(200, [{ idvatgroup: 12, percentage: 20 }] as VatGroup[]);
    // Mock products GET multiple times
    nock(nockBaseUrl)
      .get(/.products*/)
      .reply(200, [
        {
          idproduct: 'mockId',
          productcode: 'L2201308',
          stock: [{ freestock: 8 }],
        },
      ])
      .persist();
    // Mock product PUT's
    nock(nockBaseUrl)
      .put('/products/mockId', (reqBody) => {
        pushProductPayloads.push(reqBody);
        return true;
      })
      .reply(200, { idproduct: 'mockId' })
      .persist();
    const { triggerPicqerFullSync } = await adminClient.query(FULL_SYNC);
    await new Promise((r) => setTimeout(r, 500)); // Wait for job queue to finish
    expect(pushProductPayloads.length).toBe(4);
    expect(triggerPicqerFullSync).toBe(true);
  });

  // Variant that should have been updated after full sync
  let updatedVariant:
    | GetVariantsQuery['productVariants']['items'][0]
    | undefined;

  it('Should have pulled stock levels from Picqer after full sync', async () => {
    // Relies on previous trigger of full sync
    await new Promise((r) => setTimeout(r, 500)); // Wait for job queue to finish
    const variants = await getAllVariants(adminClient);
    updatedVariant = variants.find((v) => v.sku === 'L2201308');
    expect(updatedVariant?.stockOnHand).toBe(8);
  });

  it('Should have pulled custom fields from Picqer based on configured "pullFieldsFromPicqer()"', async () => {
    // We configured the plugin to always set height to 123 for testing purposes
    expect(updatedVariant?.outOfStockThreshold).toBe(123);
  });

  it('Should push custom fields to Picqer based on configured "pushFieldsToPicqer()"', async () => {
    const pushedProduct = pushProductPayloads.find(
      (p) => p.productcode === 'L2201516'
    );
    // Expect the barcode to be the same as SKU, because thats what we configure in the plugin.init()
    expect(pushedProduct?.barcode).toBe('L2201516');
  });

  it('Should push product to Picqer when updated in Vendure', async () => {
    let updatedProduct: any;
    // Mock vatgroups GET
    nock(nockBaseUrl)
      .get('/vatgroups')
      .reply(200, [{ idvatgroup: 12, percentage: 20 }] as VatGroup[]);
    // Mock products GET multiple times
    nock(nockBaseUrl)
      .get(/.products*/)
      .reply(200, [])
      .persist();
    // Mock product POST once
    nock(nockBaseUrl)
      .post(/.products*/, (reqBody) => {
        updatedProduct = reqBody;
        return true;
      })
      .reply(200, { idproduct: 'mockId' });
    const [variant] = await updateVariants(adminClient, [
      { id: 'T_1', price: 12345 },
    ]);
    await new Promise((r) => setTimeout(r, 500)); // Wait for job queue to finish
    expect(variant?.price).toBe(12345);
    expect(updatedProduct!.price).toBe(123.45);
  });

  it('Disables a product in Picqer when disabled in Vendure', async () => {
    let pushProductPayloads: any[] = [];
    // Mock vatgroups GET
    nock(nockBaseUrl)
      .get('/vatgroups')
      .reply(200, [{ idvatgroup: 12, percentage: 20 }] as VatGroup[]);
    // Mock products GET multiple times
    nock(nockBaseUrl)
      .get(/.products*/)
      .reply(200, [])
      .persist();
    // Mock product POST multiple times
    nock(nockBaseUrl)
      .post(/.products*/, (reqBody) => {
        pushProductPayloads.push(reqBody);
        return true;
      })
      .reply(200, { idproduct: 'mockId' })
      .persist();
    const product = await updateProduct(adminClient, {
      id: 'T_1',
      enabled: false,
    });
    await new Promise((r) => setTimeout(r, 500)); // Wait for job queue to finish
    expect(product?.enabled).toBe(false);
    // expect every variant to be disabled (active=false)
    expect(pushProductPayloads!.every((p) => p.active === false)).toBe(true);
  });

  it('Should update stock level on incoming webhook', async () => {
    const body = {
      event: 'products.free_stock_changed',
      data: {
        productcode: 'L2201308',
        stock: [{ freestock: 543 }],
      },
    };
    const res = await adminClient.fetch(
      `http://localhost:3050/picqer/hooks/${E2E_DEFAULT_CHANNEL_TOKEN}`,
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'X-Picqer-Signature': createSignature(body, 'test-api-key'),
        },
      }
    );
    const variants = await getAllVariants(adminClient);
    const variant = variants.find((v) => v.sku === 'L2201308');
    expect(res.ok).toBe(true);
    expect(variant?.stockOnHand).toBe(543);
  });

  it('Should fail with invalid signature', async () => {
    const res = await adminClient.fetch(
      `http://localhost:3050/picqer/hooks/${E2E_DEFAULT_CHANNEL_TOKEN}`,
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'X-Picqer-Signature': 'invalid signature',
        },
      }
    );
    expect(res.status).toBe(403);
  });

  afterAll(() => {
    return server.destroy();
  });
});
