import { DefaultLogger, EventBus, LogLevel, mergeConfig } from '@vendure/core';
import {
  ClientError,
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import * as fs from 'fs';
import gql from 'graphql-tag';
import * as path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import getFilesInAdminUiFolder from '../../test/src/compile-admin-ui.util';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { waitFor } from '../../test/src/test-helpers';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { StockDroppedBelowThresholdEvent, StockMonitoringPlugin } from '../src';

describe('Stock monitoring plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;
  const testEmailDir = path.join(__dirname, './test-emails');
  const emailHandlerConfig = {
    subject: 'Low stock',
    threshold: 100,
  };

  beforeAll(async () => {
    try {
      const files = fs.readdirSync(testEmailDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testEmailDir, file)); // Delete previous test emails
      }
    } catch (err) {}

    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        StockMonitoringPlugin.init({
          globalThreshold: 101,
          uiTab: 'Stock Monitoring',
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

  it('Should start successfully', async () => {
    await expect(serverStarted).toBe(true);
  });

  it('Fails for unauthenticated call', async () => {
    const queryPromise = adminClient.query(gql`
      query productVariantsWithLowStock {
        productVariantsWithLowStock {
          name
        }
      }
    `);
    await expect(queryPromise).rejects.toThrow(ClientError);
  });

  it('Gets variants with stock levels below threshold', async () => {
    await adminClient.asSuperAdmin();
    const { productVariantsWithLowStock } = await adminClient.query(
      GET_OUT_OF_STOCK_VARIANTS
    );
    expect(productVariantsWithLowStock.length).toBe(4);
    expect(productVariantsWithLowStock[0].name).toBeDefined();
    expect(productVariantsWithLowStock[0].enabled).toBe(true);
    expect(productVariantsWithLowStock[0].stockOnHand).toBeLessThan(101);
    expect(productVariantsWithLowStock[0].productId).toBeDefined();
  });

  it('Does not return variants with stock above threshold', async () => {
    await adminClient.asSuperAdmin();
    const { updateProductVariants } = await adminClient.query(gql`
      mutation updateProductVariants {
        updateProductVariants(
          input: [
            {
              id: 1
              stockOnHand: 105
              trackInventory: TRUE
              customFields: { stockMonitoringThreshold: 104 }
            }
          ]
        ) {
          id
          stockLevels {
            stockOnHand
            stockAllocated
          }
        }
      }
    `);
    const { productVariantsWithLowStock } = await adminClient.query(
      GET_OUT_OF_STOCK_VARIANTS
    );
    expect(productVariantsWithLowStock.length).toBe(3);
    expect(updateProductVariants[0].stockLevels[0].stockOnHand).toBe(105);
    expect(updateProductVariants[0].stockLevels[0].stockAllocated).toBe(0);
  });

  const emittedEvents: StockDroppedBelowThresholdEvent[] = [];

  it('Places an order so that variant T_1 drops below threshold of 104', async () => {
    // Listen for emitted events
    server.app
      .get(EventBus)
      .ofType(StockDroppedBelowThresholdEvent)
      .subscribe((event) => {
        emittedEvents.push(event);
      });
    const placedOrder = await createSettledOrder(shopClient, 1, true, [
      { id: 'T_1', quantity: 2 }, // 105 - 2 = 103 which is below threshold of 104
    ]);
    expect(placedOrder.lines.length).toBe(1);
    expect(placedOrder.lines[0].productVariant.id).toBe('T_1');
    expect(placedOrder.lines[0].quantity).toBe(2);
    const { productVariant } = await adminClient.query(
      gql`
        query {
          productVariant(id: "T_1") {
            stockLevels {
              stockOnHand
              stockAllocated
            }
          }
        }
      `
    );
    expect(productVariant.stockLevels[0].stockOnHand).toBe(105);
    expect(productVariant.stockLevels[0].stockAllocated).toBe(2);
  });

  it('Should have emitted an event', async () => {
    // Wait for event to be emitted asynchronously
    await waitFor(() => emittedEvents.length === 1);
    expect(emittedEvents.length).toBe(1);
    expect(emittedEvents[0].productVariant.id).toBe(1);
    expect(emittedEvents[0].stockBeforeOrder).toBe(105);
    expect(emittedEvents[0].stockAfterOrder).toBe(103);
    expect(emittedEvents[0].order?.id).toBe(1);
  });

  if (process.env.TEST_ADMIN_UI) {
    it('Should compile admin', async () => {
      const files = await getFilesInAdminUiFolder(
        __dirname,
        StockMonitoringPlugin.ui
      );
      expect(files?.length).toBeGreaterThan(0);
    }, 200000);

    afterAll(async () => {
      await server.destroy();
    }, 100000);
  }
});

export const GET_OUT_OF_STOCK_VARIANTS = gql`
  query productVariantsWithLowStock {
    productVariantsWithLowStock {
      name
      enabled
      stockOnHand
      productId
    }
  }
`;
