import { ConfigArg } from '@vendure/common/lib/generated-types';
import {
  FacetValueChecker,
  LanguageCode,
  PromotionCondition,
  PromotionOrderAction,
  PromotionOrderActionConfig,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import {
  ConfigArgValues,
  ConfigArgs,
} from '@vendure/core/dist/common/configurable-operation';
import { OrderLineWithSubscriptionFields } from './subscription-custom-fields';

/**
 * Function that executes on the given subscription
 */
type ExecuteOnSubscriptionFn<T extends ConfigArgs> = (
  ctx: RequestContext,
  currentSubscriptionPrice: number,
  orderLine: OrderLineWithSubscriptionFields,
  args: ConfigArgValues<T>
) => Promise<number>;

/**
 * A custom Promotion Action that can discount specific subscription items in an order.
 */
export class SubscriptionPromotionAction<
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
    orderLine: OrderLineWithSubscriptionFields,
    args: ConfigArg[]
  ): Promise<number> {
    return this.executeOnSubscriptionFn(
      ctx,
      currentSubscriptionPrice,
      orderLine,
      this.argsArrayToHash(args)
    );
  }
}

/**
 * Discount all subscription payments by a percentage.
 */
export const discountAllSubscriptionsByPercentage =
  new SubscriptionPromotionAction({
    code: 'discount_all_subscription_payments_by_percentage',
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
    async executeOnSubscription(
      ctx,
      currentSubscriptionPrice,
      orderLine,
      args
    ) {
      const discount = currentSubscriptionPrice * (args.discount / 100);
      return discount;
    },
  });

let facetValueChecker: FacetValueChecker;

/**
 * Discount all subscriptions with configured facetValues by a percentage.
 */
export const discountSubscriptionsWithFacets = new SubscriptionPromotionAction({
  code: 'discount_subscription_payments_with_facets_by_percentage',
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
    facets: {
      type: 'ID',
      list: true,
      ui: { component: 'facet-value-form-input' },
    },
  },
  init(injector) {
    facetValueChecker = new FacetValueChecker(
      injector.get(TransactionalConnection)
    );
  },
  async executeOnSubscription(ctx, currentSubscriptionPrice, orderLine, args) {
    if (await facetValueChecker.hasFacetValues(orderLine, args.facets, ctx)) {
      const discount = currentSubscriptionPrice * (args.discount / 100);
      return discount;
    }
    return 0;
  },
});
