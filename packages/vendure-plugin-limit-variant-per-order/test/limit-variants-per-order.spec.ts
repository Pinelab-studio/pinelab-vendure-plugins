import { DefaultLogger, LogLevel, mergeConfig, Order } from '@vendure/core';
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
import { expect, describe, beforeAll, afterAll, it, vi, test } from 'vitest';
describe('Limit variants per order plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;
  let order: Order;
  let onlyAllowPer = 2;
  let maxPerOrder = 6;
  let errorMessage = `You are only allowed to order max ${maxPerOrder} and a multiple of ${onlyAllowPer} of Laptop 13 inch 8GB`;

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
    } = await adminClient.query(
      gql`
        mutation updateProductVariants($maxPerOrder: Int, $onlyAllowPer: Int) {
          updateProductVariants(
            input: [
              {
                id: "T_1"
                customFields: {
                  maxPerOrder: $maxPerOrder
                  onlyAllowPer: $onlyAllowPer
                }
              }
            ]
          ) {
            ... on ProductVariant {
              customFields {
                maxPerOrder
                onlyAllowPer
              }
            }
          }
        }
      `,
      { maxPerOrder, onlyAllowPer }
    );
    expect(variant.customFields.maxPerOrder).toBe(maxPerOrder);
    expect(variant.customFields.onlyAllowPer).toBe(onlyAllowPer);
  });

  it('Exposes MaxPerOrder and OnlyAllowPer in shop api', async () => {
    const { product } = await shopClient.query(gql`
      {
        product(id: 1) {
          variants {
            customFields {
              maxPerOrder
              onlyAllowPer
            }
          }
        }
      }
    `);
    expect(
      product.variants.find(
        (v: any) => v.customFields.maxPerOrder === maxPerOrder
      )
    ).toBeDefined();
    expect(
      product.variants.find(
        (v: any) => v.customFields.onlyAllowPer === onlyAllowPer
      )
    ).toBeDefined();
  });

  it('Should add 2 to cart', async () => {
    const order = await addItem(shopClient, 'T_1', 2);
    expect(order.lines[0].quantity).toBe(2);
  });

  it("Can't add 1 more to cart, which would make the total quantity 3", async () => {
    const promise = addItem(shopClient, 'T_1', 1);
    await expect(promise).rejects.toThrow(errorMessage);
  });

  it('Can add 2 more to cart, which would make the total quantity 4', async () => {
    const order = await addItem(shopClient, 'T_1', 2);
    expect(order.lines[0].quantity).toBe(4);
  });

  it('Should adjust orderLine', async () => {
    const quantity = 2;
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
      { quantity }
    );
    expect(order.lines[0].quantity).toBe(quantity);
  });

  it('Should fail to  adjust orderLine to quantity(3) not multiple of onlyAllowPer', async () => {
    const quantity = 3;
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
      { quantity }
    );
    await expect(promise).rejects.toThrow(errorMessage);
  });

  it('Should fail to  adjust orderLine to quantity(7) greater than maxPerOrder', async () => {
    const quantity = 7;
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
      { quantity }
    );
    await expect(promise).rejects.toThrow(errorMessage);
  });

  afterAll(() => {
    return server.destroy();
  });
});
