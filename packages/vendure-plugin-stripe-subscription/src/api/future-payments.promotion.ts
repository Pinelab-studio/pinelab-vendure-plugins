import {
  ExecutePromotionOrderActionFn,
  Logger,
  LanguageCode,
  PromotionCondition,
  PromotionItemActionConfig,
  PromotionOrderAction,
  PromotionOrderActionConfig,
  RequestContext,
} from '@vendure/core';
import {
  ConfigArgValues,
  ConfigArgs,
} from '@vendure/core/dist/common/configurable-operation';
import { loggerCtx } from '../constants';
import { ConfigArg } from '@vendure/common/lib/generated-types';

type ExecuteOnSubscriptionFn<T extends ConfigArgs> = (
  ctx: RequestContext,
  currentSubscriptionPrice: number,
  args: ConfigArgValues<T>
) => number;

/**
 * A custom PromotionOrderAction which discounts all future subscription payments in an order.
 */
export class FuturePaymentsPromotionOrderAction<
  U extends Array<PromotionCondition<any>>,
  T extends ConfigArgs = ConfigArgs
> extends PromotionOrderAction<T, U> {
  public executeOnSubscriptionFn: ExecuteOnSubscriptionFn<T>;
  constructor(
    config: Omit<PromotionOrderActionConfig<T, U>, 'execute'> & {
      executeOnSubscription: ExecuteOnSubscriptionFn<T>;
    }
  ) {
    super({
      ...config,
      execute: () => 0, // No discounts on actual order prices
    });
    this.executeOnSubscriptionFn = config.executeOnSubscription;
  }

  executeOnSubscription(
    ctx: RequestContext,
    currentSubscriptionPrice: number,
    args: ConfigArg[]
  ): number {
    return this.executeOnSubscriptionFn(
      ctx,
      currentSubscriptionPrice,
      this.argsArrayToHash(args)
    );
  }
}

export const discountFutureSubscriptionPayments =
  new FuturePaymentsPromotionOrderAction({
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
      const discount = currentSubscriptionPrice * (args.discount / 100);
      return discount;
    },
  });
