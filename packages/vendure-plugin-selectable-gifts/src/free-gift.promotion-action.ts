import {
  FacetValueChecker,
  LanguageCode,
  Logger,
  PromotionOrderAction,
  TransactionalConnection,
} from '@vendure/core';
import { loggerCtx } from './constants';

let facetValueChecker: FacetValueChecker | undefined;
export const freeGiftPromotionAction = new PromotionOrderAction({
  code: 'free_gifts',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Allow selected products as free gift',
    },
  ],
  args: {
    variants: {
      type: 'ID',
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'These variants are allowed as gift',
        },
      ],
      list: true,
      ui: { component: 'product-selector-form-input' },
    },
  },
  init(injector) {
    facetValueChecker = new FacetValueChecker(
      injector.get(TransactionalConnection)
    );
  },

  /**
   * This is the function that defines the actual amount to be discounted.
   * It should return a negative number representing the discount in
   * pennies/cents etc. Rounding to an integer is handled automatically.
   */
  async execute(ctx, order, args) {
    const giftsInOrder = order.lines.filter(
      (line) =>
        args.variants.includes(line.productVariant.id) &&
        (line.customFields as any).isSelectedAsGift
    );
    if (!giftsInOrder.length) {
      return 0;
    }
    if (giftsInOrder.length > 1 || giftsInOrder.some((g) => g.quantity > 1)) {
      Logger.warn(
        `Order ${order.code} has more than 1 gift selected, only deducting 1 '${giftsInOrder[0].productVariant.name}' from the total price`,
        loggerCtx
      );
    }
    const unitPrice = ctx.channel.pricesIncludeTax
      ? giftsInOrder[0].unitPriceWithTax
      : giftsInOrder[0].unitPrice;
    return -unitPrice;
  },
});
