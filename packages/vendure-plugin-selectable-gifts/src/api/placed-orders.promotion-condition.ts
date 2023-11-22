import {
  FacetValueChecker,
  LanguageCode,
  Logger,
  PromotionCondition,
  TransactionalConnection,
} from '@vendure/core';
import { loggerCtx } from '../constants';

let 
/**
 * Checks if a customer has placed a certain number of orders before.
 */
export const customerHasPlacedOrders = new PromotionCondition({
  code: 'customer_has_placed_orders',
  description: [
      { languageCode: LanguageCode.en, value: 'Customer has placed { minimum } orders' },
      ],
  args: {
      minimum: {
          type: 'int',
          defaultValue: 1,
      },
      productVariantIds: {
          type: 'ID',
          list: true,
          ui: { component: 'product-selector-form-input' },
          label: [{ languageCode: LanguageCode.en, value: 'Product variants' }],
      },
  },
  init(injector) {

  }
  async check(ctx, order, args) {
      const ids = args.productVariantIds;
      let matches = 0;
      for (const line of order.lines) {
          if (lineContainsIds(ids, line)) {
              matches += line.quantity;
          }
      }
      return args.minimum <= matches;
  },
});
