import {
  LanguageCode,
  PromotionCondition,
  RequestContext,
  Order,
  OrderLine,
  ID,
  idsAreEqual,
} from '@vendure/core';

/**
 * Checks if the order has a minimum and maximum number of specified products
 */
export const buyMinMaxOfTheSpecifiedProductsCondition = new PromotionCondition({
  code: 'product_quantity',
  description: [
    {
      languageCode: LanguageCode.en,
      value:
        'Order has between { minimum } and { maximum } of the specified products',
    },
  ],
  args: {
    min: {
      label: [{ languageCode: LanguageCode.en, value: 'Minimum' }],
      type: 'int',
      ui: {
        component: 'number-form-input',
        options: { min: 0 },
      },
    },
    max: {
      label: [{ languageCode: LanguageCode.en, value: 'Maximum' }],
      type: 'int',
      ui: {
        component: 'number-form-input',
        options: { min: 0 },
      },
    },
    productVariantIds: {
      type: 'ID',
      list: true,
      ui: { component: 'product-selector-form-input' },
      label: [{ languageCode: LanguageCode.en, value: 'Product variants' }],
    },
  },
  check(ctx: RequestContext, order: Order, args) {
    if (!order.lines?.length) {
      return false;
    }

    let matches = 0;
    for (const orderLine of order.lines) {
      if (lineContainsIds(args.productVariantIds, orderLine)) {
        matches += orderLine.quantity;
      }
    }
    return matches >= args.min && matches <= args.max;
  },
});

function lineContainsIds(ids: ID[], line: OrderLine): boolean {
  return !!ids.find((id) => idsAreEqual(id, line.productVariant.id));
}
