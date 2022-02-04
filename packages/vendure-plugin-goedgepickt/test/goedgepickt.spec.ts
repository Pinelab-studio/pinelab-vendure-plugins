import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import {
  DefaultLogger,
  InitialData,
  LogLevel,
  mergeConfig,
  Order,
  OrderService,
  ProductVariant,
  ProductVariantService,
} from '@vendure/core';
import { TestServer } from '@vendure/testing/lib/test-server';
import {
  GoedgepicktConfig,
  goedgepicktHandler,
  GoedgepicktPlugin,
  IncomingOrderStatusEvent,
  IncomingStockUpdateEvent,
  OrderInput,
} from '../src';
import nock from 'nock';
import { GoedgepicktService } from '../src/api/goedgepickt.service';
import {
  createSettledOrder,
  testAddress,
  testCustomer,
} from '../../test/src/order-utils';
import { Fulfillment } from '@vendure/core/dist/entity/fulfillment/fulfillment.entity';
import {
  getGoedgepicktConfig,
  runGoedgepicktFullSync,
  updateGoedgepicktConfig,
} from '../src/ui/queries.graphql';
import fs from 'fs';
import path from 'path';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import { GoedgepicktController } from '../src/api/goedgepickt.controller';
import { GoedgepicktClient } from '../src/api/goedgepickt.client';

jest.setTimeout(20000);

describe('Goedgepickt plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
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
    .post('/api/v1/products', (reqBody) => {
      pushProductsPayloads.push(reqBody);
      return true;
    })
    .reply(200, []);
  // Get products first-time
  nock(apiUrl)
    .get('/api/v1/products')
    .query(true)
    .reply(200, {
      items: [
        {
          sku: 'L2201308',
          stock: {
            freeStock: 33,
          },
        },
      ],
    });
  // Get products second-time
  nock(apiUrl).get('/api/v1/products').query(true).reply(200, {
    items: [],
  });
  // Create order
  nock(apiUrl)
    .post('/api/v1/orders', (reqBody) => {
      createOrderPayload = reqBody;
      return true;
    })
    .reply(200, {
      message: 'Order created',
      orderUuid: 'testUuid',
    });
  // Get webshops
  nock(apiUrl)
    .persist(true)
    .get('/api/v1/webshops')
    .reply(200, { items: [{ uuid: ggConfig.webshopUuid }] });
  // get webhooks
  nock(apiUrl).persist(true).get('/api/v1/webhooks').reply(200, { items: [] });
  // Update webhooks
  nock(apiUrl)
    .persist(true)
    .post('/api/v1/webhooks', (reqBody) => {
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
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        GoedgepicktPlugin.init({
          vendureHost: 'https://test-host',
        }),
      ],
    });

    ({ server, adminClient } = createTestEnvironment(config));
    await server.init({
      initialData: initialData as InitialData,
      productsCsvPath: '../test/src/products-import.csv',
    });
    serverStarted = true;
    await adminClient.asSuperAdmin();
  }, 60000);

  it('Should start successfully', async () => {
    await expect(serverStarted).toBe(true);
  });

  it('Updates config via graphql and sets webhooks', async () => {
    const result: { updateGoedgepicktConfig: GoedgepicktConfig } =
      await adminClient.query(updateGoedgepicktConfig, {
        input: ggConfig,
      });
    await expect(result.updateGoedgepicktConfig.webshopUuid).toBe(
      ggConfig.webshopUuid
    );
    await expect(result.updateGoedgepicktConfig.orderWebhookKey).toBe(
      'test-secret'
    );
    await expect(result.updateGoedgepicktConfig.stockWebhookKey).toBe(
      'test-secret'
    );
    await expect(webhookPayloads.length).toBe(2); // Order and Stock webhooks
    await expect(webhookPayloads[0].targetUrl).toBe(
      'https://test-host/goedgepickt/webhook/e2e-default-channel'
    );
  });

  it('Retrieves config via graphql', async () => {
    const result = await adminClient.query(getGoedgepicktConfig);
    await expect(result.goedgepicktConfig.webshopUuid).toBe(
      ggConfig.webshopUuid
    );
    await expect(result.goedgepicktConfig.apiKey).toBe(ggConfig.apiKey);
  });

  it('Pushes products and updates stocklevel on FullSync', async () => {
    await adminClient.query(runGoedgepicktFullSync);
    await expect(pushProductsPayloads.length).toBe(4);
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
    await expect(updatedVariant?.stockOnHand).toBe(33);
  });

  it('Pushes order', async () => {
    const ctx = await server.app
      .get(GoedgepicktService)
      .getCtxForChannel('e2e-default-channel');
    order = await createSettledOrder(server.app, ctx as any, 1);
    const fulfillment = (await server.app
      .get(OrderService)
      .createFulfillment(ctx, {
        handler: { code: goedgepicktHandler.code, arguments: [] },
        lines: order.lines.map((line) => ({
          orderLineId: line.id,
          quantity: line.quantity,
        })),
      })) as Fulfillment;
    const { houseNumber, addition } =
      GoedgepicktService.splitHouseNumberAndAddition(testAddress.streetLine2!);
    await expect(fulfillment.handlerCode).toBe('goedgepickt');
    await expect(fulfillment.method).toBe('testUuid');
    await expect(createOrderPayload.orderId).toBe(order.code);
    await expect(createOrderPayload.shippingFirstName).toBe(
      testCustomer.firstName
    );
    await expect(createOrderPayload.shippingLastName).toBe(
      testCustomer.lastName
    );
    await expect(createOrderPayload.shippingCompany).toBe(testAddress.company);
    await expect(createOrderPayload.shippingAddress).toBe(
      testAddress.streetLine1
    );
    await expect(createOrderPayload.shippingHouseNumber).toBe(houseNumber);
    await expect(createOrderPayload.shippingHouseNumberAddition).toBe(addition);
    await expect(createOrderPayload.shippingZipcode).toBe(
      testAddress.postalCode
    );
    await expect(createOrderPayload.shippingCity).toBe(testAddress.city);
    await expect(createOrderPayload.shippingCountry).toBe(
      testAddress.countryCode
    );
  });

  it('Completes order via webhook', async () => {
    const body: IncomingOrderStatusEvent = {
      newStatus: 'completed',
      orderNumber: order.code,
      event: 'orderStatusChanged',
      orderUuid: 'doesntmatter',
    };
    const signature = GoedgepicktClient.computeSignature('test-secret', body);
    await server.app
      .get(GoedgepicktController)
      .webhook('e2e-default-channel', body, signature);
    const ctx = await server.app
      .get(GoedgepicktService)
      .getCtxForChannel('e2e-default-channel');
    order = (await server.app
      .get(OrderService)
      .findOneByCode(ctx, order.code))!;
    expect(order.state).toBe('Delivered');
  });

  it('Decreases stock via webhook', async () => {
    const body: IncomingStockUpdateEvent = {
      event: 'stockUpdated',
      newStock: '123',
      productSku: 'L2201308',
      productUuid: 'doesntmatter',
    };
    const signature = GoedgepicktClient.computeSignature('test-secret', body);
    await server.app
      .get(GoedgepicktController)
      .webhook('e2e-default-channel', body, signature);
    const updatedVariant = await findVariantBySku('L2201308');
    expect(updatedVariant.stockOnHand).toBe(123);
  });

  it('Should compile admin', async () => {
    fs.rmSync(path.join(__dirname, '__admin-ui'), {
      recursive: true,
      force: true,
    });
    await compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [GoedgepicktPlugin.ui],
    }).compile?.();
    const files = fs.readdirSync(path.join(__dirname, '__admin-ui/dist'));
    expect(files?.length).toBeGreaterThan(0);
  }, 240000);

  afterAll(() => {
    return server.destroy();
  });

  async function findVariantBySku(sku: string): Promise<ProductVariant> {
    const ctx = await server.app
      .get(GoedgepicktService)
      .getCtxForChannel('e2e-default-channel');
    const result = await server.app.get(ProductVariantService).findAll(ctx);
    return result.items.find((variant) => variant.sku === sku)!;
  }
});
