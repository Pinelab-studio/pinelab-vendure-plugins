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
import { LimitVariantPerOrderPlugin } from '../src/limit-variant-per-order.plugin';
import { addItem } from '../../test/src/shop-utils';
import { expect, describe, beforeAll, afterAll, it } from 'vitest';
import { ChannelAwareIntValue } from '../src/types';
describe('Limit variants per order plugin', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;
  let order: Order;
  let onlyAllowPer = 2;
  let maxPerOrder = 6;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        port: 3106,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [LimitVariantPerOrderPlugin],
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

  it('Sets max variants to 2', async () => {
    await adminClient.asSuperAdmin();
    const allChannelValue = [{ value: onlyAllowPer, channelId: '1' }];
    const {
      updateProductVariants: [variant],
    } = await adminClient.query(
      gql`
        mutation updateProductVariants(
          $maxPerOrder: Int
          $onlyAllowPer: [String!]
        ) {
          updateProductVariants(
            input: [
              {
                id: "1"
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
      {
        maxPerOrder,
        onlyAllowPer: allChannelValue.map((v) => JSON.stringify(v)),
      }
    );
    expect(variant.customFields.maxPerOrder).toBe(maxPerOrder);
    const channelValue =
      variant.customFields.onlyAllowPer
        .map((v) => JSON.parse(v) as ChannelAwareIntValue)
        .find((channelValue) => idsAreEqual(channelValue.channelId, 1))
        ?.value ?? 0;
    expect(channelValue).toBe(onlyAllowPer);
  });

  it('Exposes MaxPerOrder and OnlyAllowPer in shop api', async () => {
    const { product } = await shopClient.query(gql`
      {
        product(id: 1) {
          variants {
            id
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
    const variant = product.variants.find((v) => idsAreEqual(v.id, 1));
    const onlyAllowPer = JSON.parse(variant.customFields.onlyAllowPer[0]);
    expect(onlyAllowPer.value).toBe(2);
  });

  it('Should add 2 to cart', async () => {
    const order = await addItem(shopClient, '1', 2);
    expect(order.lines[0].quantity).toBe(2);
  });

  it("Can't add 1 more to cart, which would make the total quantity 3", async () => {
    const promise = addItem(shopClient, '1', 1);
    await expect(promise).rejects.toThrow(
      'You are only allowed to order a multiple of 2 Laptop 13 inch 8GBs'
    );
  });

  it('Can add 2 more to cart, which would make the total quantity 4', async () => {
    const order = await addItem(shopClient, '1', 2);
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

  it('Should fail to  adjust orderLine to quantity(3) which is not multiple of onlyAllowPer', async () => {
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
    await expect(promise).rejects.toThrow(
      'You are only allowed to order a multiple of 2 Laptop 13 inch 8GBs'
    );
  });

  it('Should fail to  adjust orderLine to quantity(7) which is greater than maxPerOrder', async () => {
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
    await expect(promise).rejects.toThrow(
      'You are only allowed to order max 6 Laptop 13 inch 8GBs'
    );
  });

  afterAll(() => {
    return server.destroy();
  });
});
