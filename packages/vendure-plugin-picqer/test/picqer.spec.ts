import {
  ChannelService,
  ConfigService,
  DefaultLogger,
  LanguageCode,
  LogLevel,
  mergeConfig,
  RequestContext,
} from '@vendure/core';
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
  getAllVariants,
  updateProduct,
  updateVariants,
} from '../../test/src/admin-utils';
import { initialData } from '../../test/src/initial-data';
import { PicqerPlugin } from '../src';
import { VatGroup } from '../src/api/types';
import { FULL_SYNC, GET_CONFIG, UPSERT_CONFIG } from '../src/ui/queries';
import { GetVariantsQuery } from '../../test/src/generated/admin-graphql';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
const nockBaseUrl = 'https://test-picqer.io/api/v1/';

jest.setTimeout(60000);

describe('Order export plugin', function () {
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
          pushFieldsToPicqer: (variant) => ({ barcode: variant.sku }),
          // Update for testing purposes
          pullFieldsFromPicqer: (picqerProd) => ({ outOfStockThreshold: 123 }),
        }),
      ],
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

    ({ server, adminClient } = createTestEnvironment(config));
    await server.init({
      initialData,
      productsCsvPath: '../test/src/products-import.csv',
    });
  }, 60000);

  it('Should start successfully', async () => {
    expect(server.app.getHttpServer).toBeDefined();
  });

  const createdHooks: any[] = [];

  it('Should update Picqer config via admin api', async () => {
    // Mock hooks GET, because webhooks are updated on config save
    nock(nockBaseUrl).get('/hooks').reply(200, []);
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
    await expect(createdHooks.length).toBe(1);
    await expect(createdHooks[0].event).toBe('products.free_stock_changed');
    await expect(createdHooks[0].address).toBe(
      `https://example-vendure.io/picqer/hooks/${E2E_DEFAULT_CHANNEL_TOKEN}`
    );
    await expect(createdHooks[0].secret).toBeDefined();
    await expect(createdHooks[0].name).toBeDefined();
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

  /**
   * Requestbodies of products that have been created or updated in Picqer
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

  it.skip('Should update stockLevels on incoming webhook', async () => {
    expect(true).toBe(false);
  });

  afterAll(() => {
    return server.destroy();
  });
});
