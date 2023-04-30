import { ExecutePromotionOrderActionFn, LanguageCode, PromotionCondition, PromotionItemActionConfig, PromotionOrderAction, PromotionOrderActionConfig } from '@vendure/core';
import { ConfigArgs } from '@vendure/core/dist/common/configurable-operation';

/**
 * A custom PromotionOrderAction which discounts all future subscription payments in an order.
 */
export class FuturePaymentsPromotionOrderAction<
  U extends Array<PromotionCondition<any>>,
  T extends ConfigArgs = ConfigArgs,
> extends PromotionOrderAction<T, U> {
  constructor(config: 
    Omit<PromotionOrderActionConfig<T, U>, 'execute'> & { executeOnSubscriptions: ExecutePromotionOrderActionFn<T, U> }) {
    super({
      ...config,
      execute: () => 0, // No discounts on actual order prices
    });
  }
}



export const discountFutureSubscriptionPayments = new FuturePaymentsPromotionOrderAction({
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
  executeOnSubscriptions(ctx, order, args) {
    return args.discount;
  }
});
