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
import { fulfill } from '../../test/src/admin-utils';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder, SettledOrder } from '../../test/src/shop-utils';
import { waitFor } from '../../test/src/test-helpers';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { StockDroppedBelowThresholdEvent, StockMonitoringPlugin } from '../src';

describe('Stock monitoring plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;

  beforeAll(async () => {
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
    await adminClient.asSuperAdmin();
    await adminClient.query(gql`
      mutation {
        updateProductVariants(
          input: [
            { id: 1, trackInventory: TRUE }
            { id: 2, trackInventory: TRUE }
            { id: 3, trackInventory: TRUE }
            { id: 4, trackInventory: TRUE }
          ]
        ) {
          id
        }
      }
    `);
    serverStarted = true;
  }, 60000);

  it('Should start successfully', async () => {
    await expect(serverStarted).toBe(true);
  });

  it('Fails for unauthenticated call', async () => {
    await adminClient.asAnonymousUser();
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
    expect(updateProductVariants[0].stockLevels[0].stockOnHand).toBe(105);
    expect(updateProductVariants[0].stockLevels[0].stockAllocated).toBe(0);
    expect(productVariantsWithLowStock.length).toBe(3);
  });

  const emittedEvents: StockDroppedBelowThresholdEvent[] = [];
  let placedOrder: SettledOrder;

  it('Places an order so that variant T_1 drops below threshold of 104', async () => {
    // Listen for emitted events
    server.app
      .get(EventBus)
      .ofType(StockDroppedBelowThresholdEvent)
      .subscribe((event) => {
        emittedEvents.push(event);
      });
    placedOrder = await createSettledOrder(shopClient, 1, true, [
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
    expect(emittedEvents[0].stockBeforeAdjustment).toBe(105);
    expect(emittedEvents[0].stockAfterAdjustment).toBe(103);
  });

  it('Does not emit the event again when the order is fulfilled', async () => {
    const fulfillment = await fulfill(
      adminClient,
      'manual-fulfillment',
      [[placedOrder.lines[0].id, 2]],
      [
        { name: 'method', value: 'Manual' },
        { name: 'trackingCode', value: 'TRACK-1' },
      ]
    );
    expect(fulfillment.state).toBe('Pending');
    await waitForEarlierStockChecks();
    const eventsForT1 = emittedEvents
      .filter((event) => event.productVariant.id === 1)
      .map((event) => [
        event.stockBeforeAdjustment,
        event.stockAfterAdjustment,
      ]);
    // Only the event from the allocation when the order was placed
    expect(eventsForT1).toEqual([[105, 103]]);
  });

  it('Does not emit the event for variants that do not track inventory', async () => {
    await adminClient.query(UPDATE_VARIANTS, {
      input: [{ id: 'T_3', trackInventory: 'FALSE' }],
    });
    // The allocation doesn't change untracked stock (100), so a stock check would see a drop from 101 to 100: below the global threshold of 101
    await createSettledOrder(shopClient, 1, true, [{ id: 'T_3', quantity: 1 }]);
    await waitForEarlierStockChecks();
    const eventsForT3 = emittedEvents
      .filter((event) => event.productVariant.id === 3)
      .map((event) => [
        event.stockBeforeAdjustment,
        event.stockAfterAdjustment,
      ]);
    expect(eventsForT3).toEqual([]);
  });

  it('Does not emit the event for variants that inherit a disabled global inventory setting', async () => {
    const { updateGlobalSettings } = await adminClient.query(
      UPDATE_GLOBAL_SETTINGS,
      { input: { trackInventory: false } }
    );
    expect(updateGlobalSettings.trackInventory).toBe(false);
    await adminClient.query(UPDATE_VARIANTS, {
      input: [{ id: 'T_4', trackInventory: 'INHERIT' }],
    });
    // Same as above: T_4's stock (100) doesn't change, so a stock check would see a drop from 101 to 100
    await createSettledOrder(shopClient, 1, true, [{ id: 'T_4', quantity: 1 }]);
    await waitForEarlierStockChecks();
    const eventsForT4 = emittedEvents
      .filter((event) => event.productVariant.id === 4)
      .map((event) => [
        event.stockBeforeAdjustment,
        event.stockAfterAdjustment,
      ]);
    expect(eventsForT4).toEqual([]);
  });

  /**
   * Waits until every stock check enqueued so far has run, so a test can assert that no event was emitted.
   * Drops marker variant T_2 below its threshold and waits for that event:
   * the test job queue runs jobs one at a time in order, so earlier checks have finished by then.
   */
  async function waitForEarlierStockChecks(): Promise<void> {
    const countMarkerEvents = () =>
      emittedEvents.filter((event) => event.productVariant.id === 2).length;
    const markerEventsBefore = countMarkerEvents();
    // Raising stock doesn't trigger a stock check
    await adminClient.query(UPDATE_VARIANTS, {
      input: [
        {
          id: 'T_2',
          stockOnHand: 1000,
          customFields: { stockMonitoringThreshold: 500 },
        },
      ],
    });
    // Dropping from 1000 to 0 crosses the threshold of 500
    await adminClient.query(UPDATE_VARIANTS, {
      input: [{ id: 'T_2', stockOnHand: 0 }],
    });
    await waitFor(() => countMarkerEvents() > markerEventsBefore);
  }

  afterAll(async () => {
    await server.destroy();
  }, 100000);
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

export const UPDATE_VARIANTS = gql`
  mutation UpdateProductVariants($input: [UpdateProductVariantInput!]!) {
    updateProductVariants(input: $input) {
      id
    }
  }
`;

export const UPDATE_GLOBAL_SETTINGS = gql`
  mutation UpdateGlobalSettings($input: UpdateGlobalSettingsInput!) {
    updateGlobalSettings(input: $input) {
      ... on GlobalSettings {
        id
        trackInventory
      }
    }
  }
`;
