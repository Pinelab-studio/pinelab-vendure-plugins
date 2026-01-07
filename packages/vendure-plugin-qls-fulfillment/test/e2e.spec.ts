import { DefaultLogger, EventBus, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  E2E_DEFAULT_CHANNEL_TOKEN,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { FulfillmentProduct, QlsPlugin } from '../src';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import {
  QlsOrderFailedEvent,
  QLSOrderError,
} from '../src/services/qls-order-failed-event';
import { gql } from 'graphql-tag';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;
let serverStarted = false;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      QlsPlugin.init({
        getConfig: () => {
          return {
            username: 'mock-username',
            password: 'mock-password',
            companyId: 'mock-company-id',
            brandId: 'mock-brand-id',
          };
        },
        getAdditionalVariantFields: (ctx, variant) => ({
          ean: variant.sku,
          additionalEANs: ['1234567890'],
        }),
        webhookSecret: '1234',
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
}, 60000);

import { beforeEach, vi } from 'vitest';
import { createMockResponse } from './util';
import { waitFor } from '../../test/src/test-helpers';
import { getAllVariants } from '../../test/src/admin-utils';
import { createSettledOrder } from '../../test/src/shop-utils';
import getFilesInAdminUiFolder from '../../test/src/compile-admin-ui.util';

beforeEach(() => {
  vi.unstubAllGlobals();
});

it('Should start successfully', async () => {
  expect(serverStarted).toBe(true);
});

it('Runs full sync', async () => {
  let createdProducts: FulfillmentProduct[] = [];
  let updatedProducts: FulfillmentProduct[] = [];
  let updatedAdditionalEANs: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url, { method, body }) => {
      // Mock the update of additional EANs
      if (method === 'POST' && url.includes('/barcodes')) {
        updatedAdditionalEANs.push(body);
        return createMockResponse({
          data: {
            id: '1',
            barcodes_and_ean: [],
            barcodes: [],
          },
        });
      }
      // Mock get all fulfillment products
      if (method === 'GET' && url.includes('fulfillment/products')) {
        return createMockResponse({
          data: [
            {
              id: '1',
              sku: 'L2201508',
              name: 'Product 1',
              amount_available: 10,
              barcodes_and_ean: [],
              barcodes: [],
            },
          ],
          meta: { code: 200 },
        });
      }
      // Mock the creation of a product in QLS
      if (method === 'POST' && url.includes('fulfillment/products')) {
        createdProducts.push(body);
        return createMockResponse({
          data: {
            id: '1',
            barcodes_and_ean: [],
            barcodes: [],
          },
        });
      }
      // Mock the update of a product in QLS
      if (method === 'PUT' && url.includes('fulfillment/products')) {
        updatedProducts.push(body);
        return createMockResponse({
          data: {
            id: '1',
            sku: '1',
            name: 'Product 1',
            amount_available: 10,
            barcodes_and_ean: [],
            barcodes: [],
          },
        });
      }
    })
  );
  await adminClient.asSuperAdmin();
  await adminClient.query(gql`
    mutation TriggerQlsProductSync {
      triggerQlsProductSync
    }
  `);
  await waitFor(() => createdProducts.length > 0 && updatedProducts.length > 0);
  expect(createdProducts[0]).toEqual(
    '{"name":"Laptop 13 inch 8GB","sku":"L2201308","ean":"L2201308"}'
  );
  expect(updatedProducts[0]).toEqual(
    '{"sku":"L2201508","name":"Laptop 15 inch 8GB","ean":"L2201508"}'
  );
  expect(updatedAdditionalEANs[0]).toEqual('{"barcode":"1234567890"}');
  const variants = await getAllVariants(adminClient);
  // This is the variant that should have received stock from QLS
  const productFromQLS = variants.find((variant) => variant.sku === 'L2201508');
  expect(productFromQLS?.stockOnHand).toBe(10);
});

it('Throws forbidden for invalid secret when updating stock via webhook', async () => {
  const res = await adminClient.fetch(
    `http://localhost:3050/qls/webhook/${E2E_DEFAULT_CHANNEL_TOKEN}?secret=not-valid-secret`,
    {
      method: 'POST',
    }
  );
  expect(res.status).toBe(403);
});

it('Updates stock via webhook', async () => {
  const res = await adminClient.fetch(
    `http://localhost:3050/qls/webhook/${E2E_DEFAULT_CHANNEL_TOKEN}?secret=1234`,
    {
      method: 'POST',
      body: JSON.stringify({
        event: 'fulfillment_product.stock',
        sku: 'L2201308',
        amount_available: 12,
      }),
    }
  );
  expect(res.status).toBe(201);
  const variants = await getAllVariants(adminClient);
  const productFromQLS = variants.find((variant) => variant.sku === 'L2201308');
  expect(productFromQLS?.stockOnHand).toBe(12);
});

it('Does not update stock when stock sync is disabled', async () => {
  QlsPlugin.options.synchronizeStockLevels = false;
  const res = await adminClient.fetch(
    `http://localhost:3050/qls/webhook/${E2E_DEFAULT_CHANNEL_TOKEN}?secret=1234`,
    {
      method: 'POST',
      body: JSON.stringify({
        event: 'fulfillment_product.stock',
        sku: 'L2201308',
        amount_available: 1234,
      }),
    }
  );
  expect(res.status).toBe(201);
  const variants = await getAllVariants(adminClient);
  const productFromQLS = variants.find((variant) => variant.sku === 'L2201308');
  expect(productFromQLS?.stockOnHand).toBe(12); // Should still be 12, not 1234
});

it('Pushes order to QLS', async () => {
  // Test excluded product as well
  QlsPlugin.options.excludeVariantFromSync = (ctx, injector, variant) => {
    if (variant.sku === 'L2201516') {
      return true;
    }
    return false;
  };
  // Add additional order fields
  QlsPlugin.options.getAdditionalOrderFields = (ctx, injector, order) => {
    return {
      delivery_options: [{ tag: 'dhl-germany-national' }],
    };
  };
  const createdOrders: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url, { method, body }) => {
      if (method === 'POST' && url.includes('fulfillment/orders')) {
        createdOrders.push(body);
        return createMockResponse({
          data: { id: '1' },
        });
      }
    })
  );
  const variants = await getAllVariants(adminClient);
  const L2201516 = variants.find((variant) => variant.sku === 'L2201516');
  const L2201508 = variants.find((variant) => variant.sku === 'L2201508');
  await createSettledOrder(shopClient, 1, true, [
    { id: L2201508!.id, quantity: 1 },
    { id: L2201516!.id, quantity: 1 }, // Should be excluded
  ]);
  await waitFor(() => createdOrders.length > 0);
  expect(JSON.parse(createdOrders[0])).toEqual({
    customer_reference: expect.any(String),
    processable: expect.any(String),
    servicepoint_code: null,
    total_price: 444260,
    receiver_contact: {
      name: 'Martinho Pinelabio',
      companyname: '',
      street: 'Verzetsstraat',
      housenumber: '12a',
      postalcode: '8923CP',
      locality: 'Liwwa',
      country: 'NL',
      email: 'hayden.zieme12@hotmail.com',
      phone: '029 1203 1336',
    },
    delivery_options: [{ tag: 'dhl-germany-national' }],
    products: [
      {
        amount_ordered: 1,
        product_id: '1',
        name: 'Laptop 15 inch 8GB',
      },
      // Should have excluded L2201516
    ],
    brand_id: 'mock-brand-id',
  });
  // await new Promise(resolve => setTimeout(resolve, 5000));
}, 20000);

it('Emits QlsOrderFailedEvent when order push fails', async () => {
  const events: QlsOrderFailedEvent[] = [];
  server.app
    .get(EventBus)
    .ofType(QlsOrderFailedEvent)
    .subscribe((event) => events.push(event));
  const errorResponse = {
    meta: { code: 400 },
    errors: {
      receiver_contact: {
        postalcode: { validPostalCode: 'Ongeldige indeling (NNNN)' },
      },
    },
    pagination: null,
  };
  // Mock fulfilment order failure response
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, { method }) => {
      return {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: {
          get: () => 'application/json',
        },
        text: async () => JSON.stringify(errorResponse),
      };
    })
  );
  await createSettledOrder(shopClient, 1, true, [{ id: '1', quantity: 1 }]);
  await waitFor(() => events.length > 0);
  expect(events.length).toBe(1);
  const event = events[0];
  expect(event.errorCode).toBe(QLSOrderError.INCORRECT_POSTAL_CODE);
  expect(event.order).toBeDefined();
  expect(event.order.code).toBeDefined();
  expect(event.failedAt).toBeInstanceOf(Date);
  expect(event.fullError).toContain('Ongeldige indeling (NNNN)');
});

if (process.env.TEST_ADMIN_UI) {
  it('Should compile admin', async () => {
    const files = await getFilesInAdminUiFolder(__dirname, QlsPlugin.ui);
    expect(files?.length).toBeGreaterThan(0);
  }, 200000);
}
