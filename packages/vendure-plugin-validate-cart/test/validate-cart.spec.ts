import { DefaultLogger, Logger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  it,
  SpyInstance,
  vi,
} from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { ValidateCartPlugin } from '../src/validate-cart.plugin';
import gql from 'graphql-tag';
import { addItem } from '../../test/src/shop-utils';

const UPDATE_PRODUCT_VARIANTS = gql`
  mutation ProductVariantUpdateMutation($input: [UpdateProductVariantInput!]!) {
    updateProductVariants(input: $input) {
      id
      trackInventory
      stockLevels {
        id
        stockLocationId
        stockOnHand
      }
    }
  }
`;

const VALIDATE_ACTIVE_ORDER = gql`
  mutation ValidateActiveOrderMutation {
    validateActiveOrder {
      message
      errorCode
      relatedOrderLineIds
    }
  }
`;

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;
let serverStarted = false;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      ValidateCartPlugin.init({
        logWarningAfterMs: 2, // Log warning after 2ms just for testing
      }),
    ],
  });
  ({ server, adminClient, shopClient } = createTestEnvironment(config));
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
  serverStarted = true;
}, 60000);

const loggerSpy = vi.spyOn(Logger, 'warn');

it('Should start successfully', async () => {
  expect(serverStarted).toBe(true);
});

it('Sets tracking inventory to true and stock to 5 for variant T_1', async () => {
  await adminClient.asSuperAdmin();
  const result = await adminClient.query(UPDATE_PRODUCT_VARIANTS, {
    input: [
      {
        id: 'T_1',
        trackInventory: 'TRUE',
        stockLevels: [
          {
            stockLocationId: 'T_1',
            stockOnHand: 5,
          },
        ],
      },
    ],
  });
  expect(result.updateProductVariants).toHaveLength(1);
  expect(result.updateProductVariants[0].id).toBe('T_1');
  expect(result.updateProductVariants[0].trackInventory).toBe('TRUE');
  expect(result.updateProductVariants[0].stockLevels).toHaveLength(1);
  expect(result.updateProductVariants[0].stockLevels[0].stockOnHand).toBe(5);
});

it('Adds 4 items to cart', async () => {
  const order = await addItem(shopClient, 'T_1', 4);
  expect(order.lines.length).toBe(1);
  expect(order.lines[0].quantity).toBe(4);
});

it('Validates cart without errors', async () => {
  const { validateActiveOrder } = await shopClient.query(VALIDATE_ACTIVE_ORDER);
  expect(validateActiveOrder.length).toBe(0);
});

it('Logged a warning', async () => {
  expect(loggerSpy).toHaveBeenCalledWith(
    expect.any(String),
    'ValidateCartPlugin'
  );
});

it('Updates stock for T_1 to 2', async () => {
  await adminClient.asSuperAdmin();
  const result = await adminClient.query(UPDATE_PRODUCT_VARIANTS, {
    input: [
      {
        id: 'T_1',
        stockLevels: [
          {
            stockLocationId: 'T_1',
            stockOnHand: 2,
          },
        ],
      },
    ],
  });
  expect(result.updateProductVariants).toHaveLength(1);
  expect(result.updateProductVariants[0].id).toBe('T_1');
  expect(result.updateProductVariants[0].stockLevels).toHaveLength(1);
  expect(result.updateProductVariants[0].stockLevels[0].stockOnHand).toBe(2);
});

it('Returns errors on validation', async () => {
  const { validateActiveOrder } = await shopClient.query(VALIDATE_ACTIVE_ORDER);
  expect(validateActiveOrder.length).toBe(1);
  expect(validateActiveOrder[0].message).toBe(
    "Insufficient stock for variants: 'Laptop 13 inch 8GB'"
  );
  expect(validateActiveOrder[0].errorCode).toBe('ITEM_UNAVAILABLE');
  expect(validateActiveOrder[0].relatedOrderLineIds).toEqual(['T_1']);
});

afterAll(async () => {
  await server.destroy();
}, 100000);
