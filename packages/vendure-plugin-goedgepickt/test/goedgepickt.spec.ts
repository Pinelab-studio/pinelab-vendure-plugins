import nock from 'nock';
import {
  DefaultLogger,
  ID,
  LanguageCode,
  LogLevel,
  mergeConfig,
  Order,
  OrderService,
  ProductService,
  ProductVariant,
  ProductVariantService,
  ShippingMethodService,
  StockLevelService,
  TransactionalConnection,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getOrder } from '../../test/src/admin-utils';
import getFilesInAdminUiFolder from '../../test/src/compile-admin-ui.util';
import { initialData } from '../../test/src/initial-data';
import { addItem, createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import {
  goedgepicktHandler,
  GoedgepicktPlugin,
  IncomingOrderStatusEvent,
  IncomingStockUpdateEvent,
  OrderInput
} from '../src';
import { GoedgepicktClient } from '../src/api/goedgepickt.client';
import { GoedgepicktService } from '../src/api/goedgepickt.service';
import { updateChannel } from './helpers';
describe('Goedgepickt plugin', function () {
  const defaultChannelToken = 'e2e-default-channel';
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;
  const ggConfig = {
    apiKey: 'test-api-key',
    webshopUuid: 'test-webshop-uuid',
  };

  let pushProductsPayloads: any[] = [];
  let createOrderPayload: OrderInput;
  let webhookPayloads: any[] = [];
  let order: Order;
  const apiUrl = 'https://account.goedgepickt.nl/';
  // Update products
  nock(apiUrl)
    .persist(true)
    .post('/api/v1/products', (reqBody: any) => {
      pushProductsPayloads.push(reqBody);
      return true;
    })
    .reply(200, []);
  // Create order
  nock(apiUrl)
    .post('/api/v1/orders', (reqBody: any) => {
      createOrderPayload = reqBody;
      return true;
    })
    .reply(200, {
      message: 'Order created',
      orderUuid: 'testUuid',
    });
  // Get order
  nock(apiUrl)
    .get('/api/v1/orders/testUuid')
    .reply(200, {
      message: 'Order created',
      orderUuid: 'testUuid',
      shipments: [
        {
          trackTraceCode: 'XYZ',
          trackTraceUrl: 'pinelab.studio/xyz',
        },
      ],
    });
  // Find by SKU
  nock(apiUrl)
    .persist(true)
    .get(
      /\/api\/v1\/products\?searchAttribute=sku&searchDelimiter=%3D&searchValue=*/
    )
    .reply(200, { items: [] });
  // Get webshops
  nock('https://account.goedgepickt.nl')
    .persist(true)
    .get('/api/v1/webshops')
    .reply(200, { items: [{ uuid: ggConfig.webshopUuid }] });
  // get webhooks
  nock(apiUrl).persist(true).get('/api/v1/webhooks').reply(200, { items: [] });
  // Update webhooks
  nock(apiUrl)
    .persist(true)
    .post('/api/v1/webhooks', (reqBody: any) => {
      webhookPayloads.push(reqBody);
      return true;
    })
    .reply(200, { webhookSecret: 'test-secret' });

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        adminListQueryLimit: 10000,
        port: 3105,
      },
      logger: new DefaultLogger({ level: LogLevel.Info }),
      plugins: [
        GoedgepicktPlugin.init({
          vendureHost: 'https://test-host',
          endpointSecret: 'test',
        }),
      ],
      paymentOptions: {
        paymentMethodHandlers: [testPaymentMethod],
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
    serverStarted = true;
    await adminClient.asSuperAdmin();
  }, 60000);

  it('Should start successfully', async () => {
    await expect(serverStarted).toBe(true);
  });

  it('Updates credentials on Channel', async () => {
    const uuidAndApiKey = ggConfig.webshopUuid + ':' + ggConfig.apiKey;
    console.log('UPDATINGG===========================')
    const result = await adminClient.query(updateChannel, {
      input: {
        id: 'T_1',
        customFields: {
          ggEnabled: true,
          ggUuidApiKey: uuidAndApiKey
        },
      },
    });
    await expect(result.updateChannel.customFields.ggUuidApiKey).toBe(
      uuidAndApiKey
    );
    await expect(webhookPayloads.length).toBe(2); // Order and Stock webhooks
    await expect(webhookPayloads[0].targetUrl).toBe(
      'https://test-host/goedgepickt/webhook/e2e-default-channel'
    );
  });

  it('Pushes products and updates stocklevel on FullSync', async () => {
    nock(apiUrl).put('/api/v1/products/test-uuid').reply(200, []);
    nock(apiUrl)
      .get('/api/v1/products')
      .query(true)
      .reply(200, {
        items: [
          {
            uuid: 'test-uuid',
            sku: 'L2201308',
            stock: {
              freeStock: 33,
            },
          },
        ],
      });
    await adminClient.query(runGoedgepicktFullSync);
    await new Promise((resolve) => setTimeout(resolve, 500)); // Some time for async event handling
    await expect(pushProductsPayloads.length).toBeGreaterThanOrEqual(3); // After multiple restarts we have 1 extra
    const laptopPayload = pushProductsPayloads.find(
      (p) => p.sku === 'L2201516'
    );
    await expect(laptopPayload.webshopUuid).toBe(ggConfig.webshopUuid);
    await expect(laptopPayload.productId).toBe('L2201516');
    await expect(laptopPayload.sku).toBe('L2201516');
    await expect(laptopPayload.name).toBe('Laptop 15 inch 16GB');
    await expect(laptopPayload.price).toBe('2299.00');
    await expect(laptopPayload.url).toBe(
      `https://test-host/admin/catalog/products/1;id=1;tab=variants`
    );
    const updatedVariant = await findVariantBySku('L2201308');
    expect(updatedVariant).toBeDefined();
    const stockOnHand = await getAvailableStock(updatedVariant?.id!);
    expect(stockOnHand).toBe(33);
  });

  it('Set goedgepickt as fulfillment handler', async () => {
    const ctx = await server.app
      .get(GoedgepicktService)
      .getCtxForChannel(defaultChannelToken);
    const shippingMethod = await server.app
      .get(ShippingMethodService)
      .update(ctx, {
        id: 1,
        fulfillmentHandler: goedgepicktHandler.code,
        translations: [],
      });
    expect(shippingMethod.fulfillmentHandlerCode).toBe('goedgepickt');
  });

  it('Pushes order after placement', async () => {
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    await addItem(shopClient, 'T_1', 1);
    const res = await shopClient.query(SET_CUSTOM_FIELDS);
    order = await createSettledOrder(shopClient, 1);
    await new Promise((resolve) => setTimeout(resolve, 500)); // Some time for async event handling
    await expect(createOrderPayload.orderId).toBe(order.code);
    await expect(createOrderPayload.orderItems.length).toBe(2);
    await expect(createOrderPayload.shippingFirstName).toBe('Hayden');
    await expect(createOrderPayload.shippingLastName).toBe('Zieme');
    await expect(createOrderPayload.shippingAddress).toBe('Verzetsstraat');
    await expect(createOrderPayload.shippingHouseNumber).toBe('12');
    await expect(createOrderPayload.shippingHouseNumberAddition).toBe('a');
    await expect(createOrderPayload.shippingZipcode).toBe('8923CP');
    await expect(createOrderPayload.shippingCity).toBe('Liwwa');
    await expect(createOrderPayload.shippingCountry).toBe('NL');
    await expect(createOrderPayload.pickupLocationData?.houseNumber).toBe(
      '13a'
    );
    await expect(createOrderPayload.pickupLocationData?.city).toBe(
      'Leeuwarden'
    );
    await expect(createOrderPayload.pickupLocationData?.locationNumber).toBe(
      '1234'
    );
    await expect(createOrderPayload.pickupLocationData?.country).toBe('NL');
    await expect(createOrderPayload.shippingMethod).toBe('Standard Shipping');
  });

  it('Fails webhook with invalid signature', async () => {
    const body: IncomingOrderStatusEvent = {
      newStatus: 'completed',
      orderNumber: order.code,
      event: 'orderStatusChanged',
      orderUuid: 'testUuid',
    };
    const signature = 'wrong-signature';
    const res = await shopClient.fetch(
      `http://localhost:3105/goedgepickt/webhook/${defaultChannelToken}`,
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          signature: signature,
        },
      }
    );
    const ctx = await server.app
      .get(GoedgepicktService)
      .getCtxForChannel(defaultChannelToken);
    order = (await server.app
      .get(OrderService)
      .findOneByCode(ctx, order.code))!;
    expect(res.ok).toBe(true);
    expect(order.state).toBe('PaymentSettled');
  });

  it('Completes order via webhook', async () => {
    const body: IncomingOrderStatusEvent = {
      newStatus: 'completed',
      orderNumber: order.code,
      event: 'orderStatusChanged',
      orderUuid: 'testUuid',
    };
    const signature = GoedgepicktClient.computeSignature(
      'test-secret',
      JSON.stringify(body)
    );
    const res = await shopClient.fetch(
      `http://localhost:3105/goedgepickt/webhook/${defaultChannelToken}`,
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          signature: signature,
        },
      }
    );
    const ctx = await server.app
      .get(GoedgepicktService)
      .getCtxForChannel(defaultChannelToken);
    order = (await server.app
      .get(OrderService)
      .findOneByCode(ctx, order.code))!;
    expect(res.ok).toBe(true);
    expect(order.state).toBe('Delivered');
  });

  it('Has fulfillment after completion', async () => {
    const adminOrder = await getOrder(adminClient, order.id as string);
    const fulfillment = adminOrder?.fulfillments?.[0];
    expect(fulfillment?.method).toBe('GoedGepickt - pinelab.studio/xyz');
    expect(fulfillment?.trackingCode).toBe('XYZ');
  });

  it('Decreases stock via webhook', async () => {
    const body: IncomingStockUpdateEvent = {
      event: 'stockUpdated',
      newStock: '123',
      productSku: 'L2201308',
      productUuid: 'doesntmatter',
    };
    const res = await shopClient.fetch(
      `http://localhost:3105/goedgepickt/webhook/${defaultChannelToken}`,
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          signature: 'some-sample-signature',
        },
      }
    );
    // Await async job processing
    await new Promise((resolve) => setTimeout(resolve, 200));
    const updatedVariant = await findVariantBySku('L2201308');
    expect(res.ok).toBe(true);
    expect(updatedVariant).toBeDefined();
    const stockOnHand = await getAvailableStock(updatedVariant?.id!);
    expect(stockOnHand).toBe(123);
  });

  it('Pushes product on product creation', async () => {
    const ctx = await server.app
      .get(GoedgepicktService)
      .getCtxForChannel(defaultChannelToken);
    await server.app.get(ProductService).create(ctx, {
      translations: [
        {
          languageCode: LanguageCode.en,
          name: 'test',
          slug: 'test',
          description: '',
        },
      ],
    });
    await server.app.get(ProductVariantService).create(ctx, [
      {
        productId: 2,
        price: 1200,
        sku: 'sku123',
        translations: [
          {
            languageCode: LanguageCode.en,
            name: 'test variant',
          },
        ],
      },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 500)); // Some time for async event handling
    const payload = pushProductsPayloads.find((p) => p.sku === 'sku123');
    expect(payload).toBeDefined();
  });

  if (process.env.TEST_ADMIN_UI) {
    it('Should compile admin', async () => {
      const files = await getFilesInAdminUiFolder(
        __dirname,
        GoedgepicktPlugin.ui
      );
      expect(files?.length).toBeGreaterThan(0);
    }, 200000);
  }

  afterAll(async () => {
    await server.destroy();
  }, 100000);

  async function findVariantBySku(sku: string): Promise<ProductVariant | null> {
    const ctx = await server.app
      .get(GoedgepicktService)
      .getCtxForChannel(defaultChannelToken);
    const transactionalConnection = server.app.get(TransactionalConnection);
    const productVariantRepo = transactionalConnection.getRepository(
      ctx,
      ProductVariant
    );
    return await productVariantRepo.findOne({
      where: { sku },
      relations: ['stockLevels'],
    });
  }

  async function getAvailableStock(productVariantId: ID): Promise<number> {
    const ctx = await server.app
      .get(GoedgepicktService)
      .getCtxForChannel(defaultChannelToken);
    const stockLevelService = server.app.get(StockLevelService);
    return (await stockLevelService.getAvailableStock(ctx, productVariantId))
      .stockOnHand;
  }
});

const SET_CUSTOM_FIELDS = gql`
  mutation {
    setOrderCustomFields(
      input: {
        customFields: {
          pickupLocationNumber: "1234"
          pickupLocationCarrier: "1"
          pickupLocationName: "Local shop"
          pickupLocationStreet: "Shopstreet"
          pickupLocationHouseNumber: "13a"
          pickupLocationZipcode: "8888HG"
          pickupLocationCity: "Leeuwarden"
          pickupLocationCountry: "nl"
        }
      }
    ) {
      ... on Order {
        id
        code
      }
      ... on NoActiveOrderError {
        errorCode
        message
      }
    }
  }
`;
