import { ExecutePromotionOrderActionFn, Logger, LanguageCode, PromotionCondition, PromotionItemActionConfig, PromotionOrderAction, PromotionOrderActionConfig, RequestContext } from '@vendure/core';
import { ConfigArgValues, ConfigArgs } from '@vendure/core/dist/common/configurable-operation';
import { loggerCtx } from '../constants';

type ExecuteOnSubscriptionFn<T extends ConfigArgs> = (ctx: RequestContext, currentSubscriptionPrice: number, args: ConfigArgValues<T>) => number;

/**
 * A custom PromotionOrderAction which discounts all future subscription payments in an order.
 */
export class FuturePaymentsPromotionOrderAction<
  U extends Array<PromotionCondition<any>>,
  T extends ConfigArgs = ConfigArgs,
> extends PromotionOrderAction<T, U> {
  public executeOnSubscription: ExecuteOnSubscriptionFn<T>;
  constructor(config: 
    Omit<PromotionOrderActionConfig<T, U>, 'execute'> & { executeOnSubscription: ExecuteOnSubscriptionFn<T> }) {
    super({
      ...config,
      execute: () => 0, // No discounts on actual order prices
    });
    this.executeOnSubscription = config.executeOnSubscription;
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
  executeOnSubscription(ctx, currentSubscriptionPrice, args) {
    console.log('======', args);
    Logger.info(`Price before promotion: ${currentSubscriptionPrice}`,loggerCtx);
    const discount = currentSubscriptionPrice * (args.discount / 100);
    Logger.info(`Discounting subscription with ${discount}}`, loggerCtx);
    return discount;
  }
});
