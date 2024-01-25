import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { SelectableGiftsPlugin } from '../src';
import {
  ADD_GIFT_TO_ORDER,
  ADD_ITEM_TO_ORDER,
  UPDATE_PRODUCT_VARIANT_STOCK_ON_HAND,
  VARIANT_STOCK_LOCATIONS,
  createPromotion,
  getEligibleGifts,
} from './helpers';
let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;
let serverStarted = false;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [SelectableGiftsPlugin],
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
}, 60000);

it('Start successfully', async () => {
  await expect(server.app.getHttpServer).toBeDefined;
});

// Free gift for orders > $0
const giftForOrdersAbove0 = 'T_2';
// Free gifts for customers with >1 placed orders
const giftForLoyalCustomer = 'T_4';

describe('Gift management via admin UI', function () {
  it('Creates a gift promotion for orders greater than $0', async () => {
    await adminClient.asSuperAdmin();
    const promotion = await createPromotion(
      adminClient,
      'Free gift for orders above $0',
      [giftForOrdersAbove0],
      [
        {
          code: 'minimum_order_amount',
          arguments: [
            {
              name: 'amount',
              value: '0',
            },
            {
              name: 'taxInclusive',
              value: 'false',
            },
          ],
        },
      ]
    );
    expect(promotion.name).toBe('Free gift for orders above $0');
  });

  it('Creates a gift promotion for customers with 1 or more placed orders', async () => {
    const promotion = await createPromotion(
      adminClient,
      'Free gift for loyal customers',
      [giftForLoyalCustomer],
      [
        {
          code: 'minimum_orders_placed',
          arguments: [
            {
              name: 'minimum',
              value: '1',
            },
            {
              name: 'maximum',
              value: '2',
            },
          ],
        },
      ]
    );
    expect(promotion.name).toBe('Free gift for loyal customers');
  });
});

describe('Storefront free gift selection', function () {
  it('Should not allow setting gift custom field via shop api', async () => {
    let error: string | undefined = undefined;
    try {
      await shopClient.query(ADD_ITEM_TO_ORDER, {
        productVariantId: 'T_1',
        quantity: 1,
        customFields: {
          isSelectedAsGift: true,
        },
      });
    } catch (e) {
      error = e.message;
    }
    expect(error).toBe('The custom field "isSelectedAsGift" is readonly');
  });

  it('Has no eligible gifts for an empty order', async () => {
    // Creates a session
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
    const eligibleGifts = await getEligibleGifts(shopClient);
    expect(eligibleGifts.length).toBe(0);
  });

  it('Add item to order, so the order has a total > $0', async () => {
    const { addItemToOrder: order } = await shopClient.query(
      ADD_ITEM_TO_ORDER,
      {
        productVariantId: 'T_1',
        quantity: 1,
      }
    );
    expect(order.lines.length).toBe(1);
    expect(order.totalWithTax).toBeGreaterThan(0);
  });

  it('Has 1 eligible gift for order > $0', async () => {
    const eligibleGifts = await getEligibleGifts(shopClient);
    expect(eligibleGifts.length).toBe(1);
    expect(eligibleGifts[0].id).toBe(giftForOrdersAbove0);
  });

  it('Adds gift to order', async () => {
    const { addSelectedGiftToOrder: order } = await shopClient.query(
      ADD_GIFT_TO_ORDER,
      { productVariantId: giftForOrdersAbove0 }
    );
    const giftLine = order.lines.find(
      (line) => line.productVariant.id === giftForOrdersAbove0
    );
    expect(order.lines.length).toBe(2);
    expect(giftLine.customFields.isSelectedAsGift).toBe(true);
    expect(giftLine.discountedUnitPriceWithTax).toBe(0);
    expect(giftLine.discountedLinePriceWithTax).toBe(0);
    expect(order.discounts[0].description).toBe(
      'Free gift for orders above $0'
    );
  });

  it('Create a new non-discounted order line when the gift is added as normal item', async () => {
    const { addItemToOrder: order } = await shopClient.query(
      ADD_ITEM_TO_ORDER,
      {
        productVariantId: giftForOrdersAbove0,
        quantity: 1,
      }
    );
    const linesWithGiftVariant = order.lines.filter(
      (line) => line.productVariant.id === giftForOrdersAbove0
    );
    expect(linesWithGiftVariant.length).toBe(2);
    expect(linesWithGiftVariant[0].discountedLinePriceWithTax).toBe(0);
    expect(linesWithGiftVariant[1].discountedLinePriceWithTax).toBe(167880);
  });

  it('Creates a placed order for customer', async () => {
    const order: any = await createSettledOrder(shopClient, 1, false);
    expect(order.code).toBeDefined();
  });

  it('Has 2 eligible gifts, because both gift promotions are now eligible: 1 order placed and order > $0', async () => {
    await shopClient.query(ADD_ITEM_TO_ORDER, {
      productVariantId: 'T_1',
      quantity: 1,
    });
    const eligibleGifts = await getEligibleGifts(shopClient);
    expect(eligibleGifts.length).toBe(2);
    // Both gifts should be eligible
    expect(
      eligibleGifts.find((g) => g.id === giftForLoyalCustomer)
    ).toBeDefined();
    expect(
      eligibleGifts.find((g) => g.id === giftForOrdersAbove0)
    ).toBeDefined();
  });

  it('Adds "Loyal customer" gift to order', async () => {
    const { addSelectedGiftToOrder: order } = await shopClient.query(
      ADD_GIFT_TO_ORDER,
      { productVariantId: giftForLoyalCustomer }
    );
    const giftLine = order.lines.find(
      (line) => line.productVariant.id === giftForLoyalCustomer
    );
    expect(order.lines.length).toBe(2);
    expect(giftLine.customFields.isSelectedAsGift).toBe(true);
    expect(giftLine.discountedUnitPriceWithTax).toBe(0);
    expect(giftLine.discountedLinePriceWithTax).toBe(0);
    // Only 1 discount can be applied
    expect(order.discounts[0].description).toBe(
      'Free gift for loyal customers'
    );
  });

  it('Adds a new gift to order and removes the old gift', async () => {
    const { addSelectedGiftToOrder: order } = await shopClient.query(
      ADD_GIFT_TO_ORDER,
      { productVariantId: giftForOrdersAbove0 }
    );
    const giftLine = order.lines.find(
      (line) => line.productVariant.id === giftForOrdersAbove0
    );
    const linesSelectedAsGift = order.lines.filter(
      (l) => l.customFields.isSelectedAsGift
    );
    expect(order.lines.length).toBe(2); // 1 gift, 1 normal item
    expect(linesSelectedAsGift.length).toBe(1);
    expect(giftLine.customFields.isSelectedAsGift).toBe(true);
    expect(giftLine.discountedUnitPriceWithTax).toBe(0);
    expect(giftLine.discountedLinePriceWithTax).toBe(0);
  });

  it('Still has eligible gifts after a gift has been added', async () => {
    const eligibleGifts = await getEligibleGifts(shopClient);
    expect(eligibleGifts.length).toBeGreaterThan(0);
  });

  it('Creates 2 more placed orders for customer', async () => {
    const order: any = await createSettledOrder(shopClient, 1, false);
    expect(order.code).toBeDefined();
    const order2: any = await createSettledOrder(shopClient, 1, false);
    expect(order2.code).toBeDefined();
  });

  it('Has 1 eligible gift, because the customer has placed 3 orders, and the configured max is 2', async () => {
    await shopClient.query(ADD_ITEM_TO_ORDER, {
      productVariantId: 'T_1',
      quantity: 1,
    });
    const eligibleGifts = await getEligibleGifts(shopClient);
    expect(eligibleGifts.length).toBe(1);
    expect(eligibleGifts[0].name).not.toBeUndefined();
    expect(eligibleGifts[0].name).not.toBeNull();
    expect(eligibleGifts[0].name?.trim()).not.toEqual('');
    expect(eligibleGifts[0].priceWithTax).toBeGreaterThan(0);
  });

  it('Should return only in stock variants as eligible gifts', async () => {
    const {
      productVariant: { stockLevels },
    } = await adminClient.query(VARIANT_STOCK_LOCATIONS, {
      id: giftForOrdersAbove0,
    });
    const stockLevelUpdateInput: any[] = [];
    for (let stockLevel of stockLevels) {
      stockLevelUpdateInput.push({
        stockLocationId: (stockLevel as any).stockLocation.id,
        stockOnHand: 0,
      });
    }
    const { updateProductVariants } = await adminClient.query(
      UPDATE_PRODUCT_VARIANT_STOCK_ON_HAND,
      { id: giftForOrdersAbove0, stockLevels: stockLevelUpdateInput }
    );
    expect(updateProductVariants[0].id).toBe(giftForOrdersAbove0);
    expect(updateProductVariants[0].stockLevel).toBe('OUT_OF_STOCK');
    const eligibleGifts = await getEligibleGifts(shopClient);
    expect(eligibleGifts.length).toBe(0);
  });

  afterAll(() => {
    return server.destroy();
  });
});
