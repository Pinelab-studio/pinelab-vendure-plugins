import { LanguageCode, PromotionOrderAction } from '@vendure/core';

export const discountFutureSubscriptionPayments = new PromotionOrderAction({
  // See the custom condition example above for explanations
  // of code, description & args fields.
  code: 'discount_future_subscription_payments',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Discount future subscription payments by { discount } %',
    },
  ],
  args: {
    discount: {
      type: 'int',
      ui: {
        component: 'number-form-input',
        suffix: '%',
      },
    },
  },

  /**
   * This is the function that defines the actual amount to be discounted.
   * It should return a negative number representing the discount in
   * pennies/cents etc. Rounding to an integer is handled automatically.
   */
  execute(ctx, order, args) {
    // This discount affects future payments, not the current order total. See @link PricingHelper for more information
    return 0;
  },
});
