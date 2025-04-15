import nock from 'nock';
import {
  AvailableStock,
  configureDefaultOrderProcess,
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
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { getOrder, updateVariants } from '../../test/src/admin-utils';
import getFilesInAdminUiFolder from '../../test/src/compile-admin-ui.util';
import { initialData } from '../../test/src/initial-data';
import {
  addItem,
  createSettledOrder,
  SettledOrder,
} from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import {
  goedgepicktHandler,
  GoedgepicktPlugin,
  IncomingOrderStatusEvent,
  IncomingStockUpdateEvent,
  OrderInput,
} from '../src';
import { GoedgepicktService } from '../src/api/goedgepickt.service';
import { updateChannel } from './helpers';
import { waitFor } from '../../test/src/test-helpers';
import { GlobalFlag } from '@vendure/common/lib/generated-types';

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
  let webhookPayloads: any[] = [];
  let createOrderPayload: OrderInput;
  let order: SettledOrder;
  const apiUrl = 'https://account.goedgepickt.nl/';

  afterEach(() => {
    const pendingMocks = nock.pendingMocks();
    if (pendingMocks.length > 0) {
      console.error("Pending mocks that weren't called:", pendingMocks);
    }
    nock.cleanAll();
  });

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
      orderOptions: {
        process: [
          configureDefaultOrderProcess({ checkFulfillmentStates: false }),
        ] as any,
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

  it('Should track inventory of all variants', async () => {
    await adminClient.asSuperAdmin();
    const variants = await updateVariants(adminClient, [
      { id: 'T_1', trackInventory: GlobalFlag.TRUE },
      { id: 'T_2', trackInventory: GlobalFlag.TRUE },
      { id: 'T_3', trackInventory: GlobalFlag.TRUE },
      { id: 'T_4', trackInventory: GlobalFlag.TRUE as any },
    ]);
    const everyVariantHasStockTracking = variants.every(
      (v) => v!.trackInventory === (GlobalFlag.TRUE as any)
    );
    expect(everyVariantHasStockTracking).toBe(true);
  });

  it('Updates credentials on Channel', async () => {
    const uuidAndApiKey = ggConfig.webshopUuid + ':' + ggConfig.apiKey;
    const result = await adminClient.query(updateChannel, {
      input: {
        id: 'T_1',
        customFields: {
          ggEnabled: true,
          ggUuidApiKey: uuidAndApiKey,
        },
      },
    });
    await expect(result.updateChannel.customFields.ggUuidApiKey).toBe(
      uuidAndApiKey
    );
  });

  it('Pushes products and updates stock level on FullSync', async () => {
    // Pretend there are no webhooks set
    nock(apiUrl)
      .persist(true)
      .get('/api/v1/webhooks')
      .reply(200, { items: [] });
    // Catch the creation of webhooks
    nock(apiUrl)
      .persist(true)
      .post('/api/v1/webhooks', (reqBody: any) => {
        webhookPayloads.push(reqBody);
        return true;
      })
      .reply(200, { webhookSecret: 'test-secret' });
    // Catch the lookup of products
    nock(apiUrl)
      .persist(true)
      .get(
        /\/api\/v1\/products\?searchAttribute=sku&searchDelimiter=%3D&searchValue=*/
      )
      .reply(200, {
        items: [],
      });
    // Catch the creation of products
    nock(apiUrl)
      .persist(true)
      .post('/api/v1/products', (reqBody: any) => {
        pushProductsPayloads.push(reqBody);
        return true;
      })
      .reply(200, []);

    nock(apiUrl)
      .persist(true)
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
    nock(apiUrl).put('/api/v1/products/test-uuid').reply(200, []);
    await adminClient.query(
      gql`
        mutation {
          runGoedgepicktFullSync
        }
      `
    );
    await waitFor(() => pushProductsPayloads.length > 3);
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
    const stock = await getAvailableStock(updatedVariant?.id!);
    expect(stock.stockOnHand).toBe(33);
    expect(stock.stockAllocated).toBe(0);
    await waitFor(() => webhookPayloads.length >= 2);
    expect(webhookPayloads.length).toBe(2);
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
    // Catch order creation
    nock(apiUrl)
      .post('/api/v1/orders', (reqBody: any) => {
        createOrderPayload = reqBody;
        return true;
      })
      .reply(200, {
        message: 'Order created',
        orderUuid: 'testUuid',
      });
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    await addItem(shopClient, 'T_1', 1);
    await shopClient.query(SET_CUSTOM_FIELDS);
    order = await createSettledOrder(shopClient, 1);
    await waitFor(() => !!createOrderPayload); // Wait for async jobs to process
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
    const stock = await getAvailableStock(1);
    expect(stock.stockOnHand).toBe(33);
    expect(stock.stockAllocated).toBe(2);
  });

  it('Decreases stock via webhook and resets allocated', async () => {
    // Catch product lookup, and mock an update
    nock(apiUrl)
      .persist(true)
      .get(
        /\/api\/v1\/products\?searchAttribute=sku&searchDelimiter=%3D&searchValue=*/
      )
      .reply(200, {
        items: [
          {
            uuid: 'test-uuid',
            sku: 'L2201308',
            stock: {
              freeStock: 123,
            },
          },
        ],
      });
    const body: IncomingStockUpdateEvent = {
      event: 'stockUpdated',
      newStock: 'doestn matter',
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
    const updatedVariant = await findVariantBySku('L2201308');
    expect(res.ok).toBe(true);
    expect(updatedVariant).toBeDefined();
    // Wait for async job processing to have processed stock
    await waitFor(async () => {
      const stock = await getAvailableStock(updatedVariant?.id!);
      return stock?.stockOnHand === 123;
    });
    const stock = await getAvailableStock(updatedVariant?.id!);
    expect(stock.stockOnHand).toBe(123);
    expect(stock.stockAllocated).toBe(0);
  });

  it('Completes order via webhook', async () => {
    // Catch order fetching
    nock(apiUrl)
      .get('/api/v1/orders/testUuid')
      .reply(200, {
        message: 'Order created',
        orderUuid: 'testUuid',
        status: 'completed',
        shipments: [
          {
            trackTraceCode: 'XYZ',
            trackTraceUrl: 'pinelab.studio/xyz',
          },
        ],
      });
    const body: IncomingOrderStatusEvent = {
      newStatus: 'completed',
      orderNumber: order.code,
      event: 'orderStatusChanged',
      orderUuid: 'testUuid',
    };
    const res = await shopClient.fetch(
      `http://localhost:3105/goedgepickt/webhook/${defaultChannelToken}`,
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          signature: 'test-signature',
        },
      }
    );
    const ctx = await server.app
      .get(GoedgepicktService)
      .getCtxForChannel(defaultChannelToken);
    const adminOrder = (await server.app
      .get(OrderService)
      .findOneByCode(ctx, order.code))!;
    expect(res.ok).toBe(true);
    expect(adminOrder.state).toBe('Delivered');
    const stock = await getAvailableStock(1);
    expect(stock.stockOnHand).toBe(121); // Deducted 2 because of allocation
    expect(stock.stockAllocated).toBe(-2);
  });

  it('Has fulfillment after completion', async () => {
    const adminOrder = await getOrder(adminClient, order.id as string);
    const fulfillment = adminOrder?.fulfillments?.[0];
    expect(fulfillment?.method).toBe('GoedGepickt - XYZ');
    expect(fulfillment?.trackingCode).toBe('XYZ');
  });

  it('Pushes product on product creation', async () => {
    // Catch the product lookup
    nock(apiUrl)
      .persist(true)
      .get(
        /\/api\/v1\/products\?searchAttribute=sku&searchDelimiter=%3D&searchValue=*/
      )
      .reply(200, {
        items: [],
      });
    // Catch product creation
    nock(apiUrl)
      .persist(true)
      .post('/api/v1/products', (reqBody: any) => {
        pushProductsPayloads.push(reqBody);
        return true;
      })
      .reply(200, []);
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
    const payload = await waitFor(
      () => !!pushProductsPayloads.find((p) => p.sku === 'sku123')
    );
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

  async function getAvailableStock(
    productVariantId: ID
  ): Promise<AvailableStock> {
    const ctx = await server.app
      .get(GoedgepicktService)
      .getCtxForChannel(defaultChannelToken);
    const stockLevelService = server.app.get(StockLevelService);
    return await stockLevelService.getAvailableStock(ctx, productVariantId);
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
