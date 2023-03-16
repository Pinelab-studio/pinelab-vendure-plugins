import { LanguageCode, Logger, PromotionItemAction } from '@vendure/core';
import { loggerCtx } from './constants';

export const freeGiftPromotionAction = new PromotionItemAction({
  code: 'free_gifts',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Allow products with facets as free gift',
    },
  ],
  args: {
    amountOfGiftsAllowed: {
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'The amount of gifts allowed in an order',
        },
      ],
      type: 'int',
      ui: { component: 'number-form-input' },
    },
    facets: {
      type: 'ID',
      list: true,
      ui: { component: 'facet-value-form-input' },
    },
  },

  /**
   * This is the function that defines the actual amount to be discounted.
   * It should return a negative number representing the discount in
   * pennies/cents etc. Rounding to an integer is handled automatically.
   */
  execute(ctx, order, args) {
    Logger.info(`Free gifts action executed ------`, loggerCtx);
    return 0;
  },
});
