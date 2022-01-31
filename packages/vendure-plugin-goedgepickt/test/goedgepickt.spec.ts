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
  OrderService,
  ProductVariantService,
} from '@vendure/core';
import { TestServer } from '@vendure/testing/lib/test-server';
import {
  GoedgepicktConfig,
  goedgepicktHandler,
  GoedgepicktPlugin,
} from '../src';
import nock from 'nock';
import { GoedgepicktService } from '../src/api/goedgepickt.service';
import { createSettledOrder } from '../../test/src/order-utils';
import { Fulfillment } from '@vendure/core/dist/entity/fulfillment/fulfillment.entity';
import {
  getGoedgepicktConfig,
  updateGoedgepicktConfig,
} from '../src/ui/queries.graphql';
import fs from 'fs';
import path from 'path';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';

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
  let createOrderPayload;
  let webhookPayloads: any[] = [];
  const apiUrl = 'https://account.goedgepickt.nl/';
  // Update products
  nock(apiUrl)
    .persist(true)
    .post('/api/v1/products', (reqBody) => {
      pushProductsPayloads.push(reqBody);
      return true;
    })
    .reply(200, []);
  // Get products first
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
  // Get products second
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
  // Update webhooks
  nock(apiUrl)
    .persist(true)
    .post('/api/v1/webhooks', (reqBody) => {
      webhookPayloads.push(reqBody);
      return true;
    })
    .reply(200, { secret: 'test-secret' });

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
    await expect(webhookPayloads[0].targetUrl).toBe('https://test-host');
  });

  it('Retrieves config via graphql', async () => {
    const result = await adminClient.query(getGoedgepicktConfig);
    await expect(result.goedgepicktConfig.webshopUuid).toBe(
      ggConfig.webshopUuid
    );
    await expect(result.goedgepicktConfig.apiKey).toBe(ggConfig.apiKey);
  });

  it('Pushes all products', async () => {
    await server.app
      .get(GoedgepicktService)
      .pushProducts('e2e-default-channel');
    await expect(pushProductsPayloads.length).toBe(4);
    const laptopPayload = pushProductsPayloads.find(
      (p) => p.sku === 'L2201516'
    );
    await expect(laptopPayload.webshopUuid).toBe(ggConfig.webshopUuid);
    await expect(laptopPayload.productId).toBe('L2201516');
    await expect(laptopPayload.sku).toBe('L2201516');
  });

  it('Pulls and updates stockLevels', async () => {
    await server.app
      .get(GoedgepicktService)
      .pullStocklevels('e2e-default-channel');
    const ctx = await server.app
      .get(GoedgepicktService)
      .getCtxForChannel('e2e-default-channel');
    const result = await server.app.get(ProductVariantService).findAll(ctx);
    const updatedVariant = result.items.find(
      (variant) => variant.sku === 'L2201308'
    );
    await expect(updatedVariant?.stockOnHand).toBe(33);
  });

  it('Pushes order', async () => {
    const ctx = await server.app
      .get(GoedgepicktService)
      .getCtxForChannel('e2e-default-channel');
    const order = await createSettledOrder(server.app, ctx as any, 1);
    const fulfillment = (await server.app
      .get(OrderService)
      .createFulfillment(ctx, {
        handler: { code: goedgepicktHandler.code, arguments: [] },
        lines: order.lines.map((line) => ({
          orderLineId: line.id,
          quantity: line.quantity,
        })),
      })) as Fulfillment;
    await expect(fulfillment.handlerCode).toBe('goedgepickt');
    await expect(fulfillment.method).toBe('testUuid');
  });

  it.skip('Should compile admin', async () => {
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

  // TODO incoming webhook order status
  // TODO incoming webhook stock update

  afterAll(() => {
    return server.destroy();
  });
});
