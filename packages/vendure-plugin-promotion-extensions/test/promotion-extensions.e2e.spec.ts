import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { buyMinMaxOfTheSpecifiedProductsCondition } from '../src';
import gql from 'graphql-tag';
import { addItem } from '../../test/src/shop-utils';

describe('Promotion Extensions plugin', () => {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      promotionOptions: {
        promotionConditions: [buyMinMaxOfTheSpecifiedProductsCondition],
      },
    });

    ({ server, adminClient, shopClient } = createTestEnvironment(config));
    await server.init({
      initialData,
      productsCsvPath: '../test/src/products-import.csv',
    });
  }, 60000);

  afterAll(async () => {
    await server.destroy();
  });

  it('should start successfully', async () => {
    expect(server.app.getHttpServer).toBeDefined();
  });

  it('creates a promotion with min 1 and max 5 of product variant 1', async () => {
    await adminClient.asSuperAdmin();
    const { createPromotion } = await adminClient.query(
      CREATE_PROMOTION,
      createPromotionInput({
        name: '$5 off for 1-5 items',
        productVariantId: 'T_1',
        min: '1',
        max: '5',
        discountAmount: '500',
      })
    );
    expect(createPromotion.name).toBe('$5 off for 1-5 items');
  });

  it('creates a promotion with min 6 and max 10 of product variant 1', async () => {
    await adminClient.asSuperAdmin();
    const { createPromotion } = await adminClient.query(
      CREATE_PROMOTION,
      createPromotionInput({
        name: '$10 off for 6-10 items',
        productVariantId: 'T_1',
        min: '6',
        max: '10',
        discountAmount: '1000',
      })
    );
    expect(createPromotion.name).toBe('$10 off for 6-10 items');
  });

  it('adds 1 item of variant 1 and checks if discount is $5', async () => {
    await shopClient.asAnonymousUser();
    const order = await addItem(shopClient, 'T_1', 1);
    expect(order.lines.length).toBe(1);
    expect(order.lines[0].discounts[0].amount).toBe(-500);
    expect(order.lines[0].quantity).toBe(1);
  });

  it('adds 6 more items of variant 1 and checks if discount is $10', async () => {
    const order = await addItem(shopClient, 'T_1', 6);
    expect(order.lines.length).toBe(1);
    expect(order.lines[0].discounts[0].amount).toBe(-1000);
    expect(order.lines[0].quantity).toBe(7);
  });

  it('adds 4 more items of variant 1 and checks if no discount is applied anymore', async () => {
    // Promotions only cover 1-5 and 6-10, this test makes the quantity 11, so no discount should be applied
    const order = await addItem(shopClient, 'T_1', 4);
    expect(order.lines.length).toBe(1);
    expect(order.lines[0].discounts.length).toBe(0);
    expect(order.lines[0].quantity).toBe(11);
  });

  it('adds 1 item of variant 2 and checks if no discount is applied', async () => {
    // Variant 2 is not part of the promotions, so no discount should be applied
    await shopClient.asAnonymousUser(); // New order
    const order = await addItem(shopClient, 'T_2', 1);
    expect(order.lines.length).toBe(1);
    expect(order.lines[0].discounts.length).toBe(0);
    expect(order.lines[0].quantity).toBe(1);
  });
});

const createPromotionInput = ({
  name,
  productVariantId,
  min,
  max,
  discountAmount,
}: {
  name: string;
  productVariantId: string;
  min: string;
  max: string;
  discountAmount: string;
}) => {
  return {
    input: {
      conditions: [
        {
          code: 'product_quantity',
          arguments: [
            {
              name: 'min',
              value: min,
            },
            {
              name: 'max',
              value: max,
            },
            {
              name: 'productVariantIds',
              value: `[\"${productVariantId}\"]`,
            },
          ],
        },
      ],
      actions: [
        {
          code: 'order_fixed_discount',
          arguments: [
            {
              name: 'discount',
              value: discountAmount,
            },
          ],
        },
      ],
      couponCode: null,
      startsAt: null,
      endsAt: null,
      perCustomerUsageLimit: null,
      usageLimit: null,
      enabled: true,
      translations: [
        {
          languageCode: 'en',
          name: name,
          description: '',
          customFields: {},
        },
      ],
      customFields: {},
    },
  };
};
const CREATE_PROMOTION = gql`
  mutation CreatePromotion($input: CreatePromotionInput!) {
    createPromotion(input: $input) {
      ... on Promotion {
        id
        name
      }
    }
  }
`;
