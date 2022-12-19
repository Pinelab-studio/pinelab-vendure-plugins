import {
  DefaultLogger,
  LogLevel,
  mergeConfig,
  Order,
  ProductVariant,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { initialData } from '../../test/src/initial-data';
import gql from 'graphql-tag';
import { LimitVariantPerOrderPlugin } from '../src/limit-variant-per-order.plugin';
import { addItem } from '../../test/src/shop-utils';

describe('Limit variants per order plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;
  let order: Order;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        port: 3106,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [LimitVariantPerOrderPlugin],
    });

    ({ server, adminClient, shopClient } = createTestEnvironment(config));
    await server.init({
      initialData: {
        ...initialData,
      },
      productsCsvPath: '../test/src/products-import.csv',
      customerCount: 2,
    });
    serverStarted = true;
    await adminClient.asSuperAdmin();
  }, 60000);

  it('Should start successfully', async () => {
    await expect(serverStarted).toBe(true);
  });

  it('Sets max variants to 2', async () => {
    await adminClient.asSuperAdmin();
    const {
      updateProductVariants: [variant],
    } = await adminClient.query(gql`
      mutation {
        updateProductVariants(
          input: [{ id: "T_1", customFields: { maxPerOrder: 2 } }]
        ) {
          ... on ProductVariant {
            customFields {
              maxPerOrder
            }
          }
        }
      }
    `);
    expect(variant.customFields.maxPerOrder).toBe(2);
  });

  it('Exposes MaxPerOrder in shop api', async () => {
    const { product } = await shopClient.query(gql`
      {
        product(id: 1) {
          variants {
            customFields {
              maxPerOrder
            }
          }
        }
      }
    `);
    expect(
      product.variants.find((v: any) => v.customFields.maxPerOrder === 2)
    ).toBeDefined();
  });

  it('Can add 1 to cart', async () => {
    const order = await addItem(shopClient, 'T_1', 1);
    expect(order.lines[0].quantity).toBe(1);
  });

  it('Fails to add 2 more to cart', async () => {
    const promise = addItem(shopClient, 'T_1', 2);
    await expect(promise).rejects.toThrow(
      'You are only allowed to order max 2 of Laptop 13 inch 8GB'
    );
  });

  it('Can add 1 more to cart', async () => {
    const order = await addItem(shopClient, 'T_1', 1);
    expect(order.lines[0].quantity).toBe(2);
  });

  afterAll(() => {
    return server.destroy();
  });
});
