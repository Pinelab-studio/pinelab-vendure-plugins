import {
  AutoIncrementIdStrategy,
  DefaultLogger,
  idsAreEqual,
  LogLevel,
  mergeConfig,
  Order,
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
import { LimitedProductsPlugin } from '../src/limited-products.plugin';
import { addItem } from '../../test/src/shop-utils';
import { expect, describe, beforeAll, afterAll, it } from 'vitest';
import { ChannelAwareIntValue } from '../src/types';
import getFilesInAdminUiFolder from '../../test/src/compile-admin-ui.util';
describe('Limit variants per order plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        port: 3106,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [LimitedProductsPlugin],
      entityOptions: {
        entityIdStrategy: new AutoIncrementIdStrategy(),
      },
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

  it('Sets maxPerOrder to 6, and onlyAllowPer to 2', async () => {
    await adminClient.asSuperAdmin();
    const { updateProduct: product } = await adminClient.query(
      gql`
        mutation updateProduct(
          $maxPerOrder: [String!]
          $onlyAllowPer: [String!]
        ) {
          updateProduct(
            input: {
              id: "1"
              customFields: {
                maxPerOrder: $maxPerOrder
                onlyAllowPer: $onlyAllowPer
              }
            }
          ) {
            ... on Product {
              customFields {
                maxPerOrder
                onlyAllowPer
              }
            }
          }
        }
      `,
      {
        maxPerOrder: [JSON.stringify({ value: 6, channelId: '1' })],
        onlyAllowPer: [JSON.stringify({ value: 2, channelId: '1' })],
      }
    );
    expect(product.customFields.maxPerOrder).toEqual([
      JSON.stringify({ value: 6, channelId: '1' }),
    ]);
    expect(product.customFields.onlyAllowPer).toEqual([
      JSON.stringify({ value: 2, channelId: '1' }),
    ]);
  });

  it('Exposes the limits via the shop api', async () => {
    const { product } = await shopClient.query(gql`
      {
        product(id: 1) {
          maxQuantityPerOrder
          limitPurchasePerMultipleOf
        }
      }
    `);
    expect(product.maxQuantityPerOrder).toBe(6);
    expect(product.limitPurchasePerMultipleOf).toBe(2);
  });

  it('Can add 2 to cart', async () => {
    const order = await addItem(shopClient, '1', 2);
    expect(order.lines[0].quantity).toBe(2);
  });

  it("Can't add 1 more to cart, because only multiples of 2 are allowed", async () => {
    await expect(addItem(shopClient, '1', 1)).rejects.toThrow(
      "You are only allowed to order a multiple of 2 item 'Laptop 13 inch 8GB'"
    );
  });

  it('Can add 2 more to cart, because the total will be a multiple of 2', async () => {
    const order = await addItem(shopClient, '1', 2);
    expect(order.lines[0].quantity).toBe(4);
  });

  it("Can't adjust order line to 3, because only multiples of 2 are allowed", async () => {
    const promise = shopClient.query(
      gql`
        mutation adjustOrderLine($quantity: Int!) {
          adjustOrderLine(orderLineId: 1, quantity: $quantity) {
            ... on Order {
              lines {
                quantity
              }
            }
          }
        }
      `,
      { quantity: 3 }
    );
    await expect(promise).rejects.toThrow(
      "You are only allowed to order a multiple of 2 item 'Laptop 13 inch 8GB'"
    );
  });

  it('Can adjust order line to 2', async () => {
    const { adjustOrderLine: order } = await shopClient.query(
      gql`
        mutation adjustOrderLine($quantity: Int!) {
          adjustOrderLine(orderLineId: 1, quantity: $quantity) {
            ... on Order {
              lines {
                quantity
              }
            }
          }
        }
      `,
      { quantity: 2 }
    );
    expect(order.lines[0].quantity).toBe(2);
  });

  it('Fails to  adjust order line to 7, because that is greater than maxQuantityPerOrder', async () => {
    const promise = shopClient.query(
      gql`
        mutation adjustOrderLine($quantity: Int!) {
          adjustOrderLine(orderLineId: 1, quantity: $quantity) {
            ... on Order {
              lines {
                quantity
              }
            }
          }
        }
      `,
      { quantity: 7 }
    );
    await expect(promise).rejects.toThrow(
      "You are only allowed to order max 6 of item 'Laptop 13 inch 8GB'"
    );
  });

  if (process.env.TEST_ADMIN_UI) {
    it('Should compile admin', async () => {
      const files = await getFilesInAdminUiFolder(
        __dirname,
        LimitedProductsPlugin.uiExtensions
      );
      expect(files?.length).toBeGreaterThan(0);
    }, 200000);
  }

  afterAll(() => {
    return server.destroy();
  });
});
