import { ConfigArg } from '@vendure/common/lib/generated-types';
import {
  FacetValueChecker,
  ID,
  LanguageCode,
  OrderLine,
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

export const allByPercentage = new SubscriptionPromotionAction({
  code: 'discount_all_subscription_payments_by_percentage',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Discount all subscription payments by { discount } %',
    },
  ],
  args: {
    discount: {
      type: 'float',
      ui: {
        component: 'number-form-input',
        suffix: '%',
      },
    },
  },
  async executeOnSubscription(ctx, currentSubscriptionPrice, orderLine, args) {
    const discount = currentSubscriptionPrice * (args.discount / 100);
    return -discount;
  },
});

let facetValueChecker: FacetValueChecker;

export const withFacetsByPercentage = new SubscriptionPromotionAction({
  code: 'discount_subscription_payments_with_facets_by_percentage',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Discount subscription payments with facets by { discount } %',
    },
  ],
  args: {
    discount: {
      type: 'float',
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
      return -discount;
    }
    return 0;
  },
});

export const withFacetsByFixedAmount = new SubscriptionPromotionAction({
  code: 'discount_subscription_payments_with_facets_by_fixed_amount',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Discount subscription payments with facets by fixed amount',
    },
  ],
  args: {
    amount: {
      type: 'int',
      ui: {
        component: 'currency-form-input',
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
      const discount = -Math.min(args.amount, currentSubscriptionPrice); // make sure we don't discount more than the current price
      return discount;
    }
    return 0;
  },
});

function lineContainsIds(ids: ID[], line: OrderLine): boolean {
  return !!ids.find((id) => id == line.productVariant.id);
}

export const selectedProductsByPercentage = new SubscriptionPromotionAction({
  code: 'discount_subscription_payments_for_selected_products_by_percentage',
  description: [
    {
      languageCode: LanguageCode.en,
      value:
        'Discount subscription payments for selected products by percentage',
    },
  ],
  args: {
    discount: {
      type: 'float',
      ui: {
        component: 'number-form-input',
        suffix: '%',
      },
    },
    productVariantIds: {
      type: 'ID',
      list: true,
      ui: { component: 'product-selector-form-input' },
      label: [{ languageCode: LanguageCode.en, value: 'Product variants' }],
    },
  },
  init(injector) {
    facetValueChecker = new FacetValueChecker(
      injector.get(TransactionalConnection)
    );
  },
  async executeOnSubscription(ctx, currentSubscriptionPrice, orderLine, args) {
    if (lineContainsIds(args.productVariantIds, orderLine)) {
      const discount = currentSubscriptionPrice * (args.discount / 100);
      return -discount;
    }
    return 0;
  },
});

export const selectedProductsByFixedAmount = new SubscriptionPromotionAction({
  code: 'discount_subscription_payments_for_selected_products_by_fixed_amount',
  description: [
    {
      languageCode: LanguageCode.en,
      value:
        'Discount subscription payments for selected products by fixed amount',
    },
  ],
  args: {
    amount: {
      type: 'int',
      ui: {
        component: 'currency-form-input',
      },
    },
    productVariantIds: {
      type: 'ID',
      list: true,
      ui: { component: 'product-selector-form-input' },
      label: [{ languageCode: LanguageCode.en, value: 'Product variants' }],
    },
  },
  init(injector) {
    facetValueChecker = new FacetValueChecker(
      injector.get(TransactionalConnection)
    );
  },
  async executeOnSubscription(ctx, currentSubscriptionPrice, orderLine, args) {
    if (lineContainsIds(args.productVariantIds, orderLine)) {
      const discount = -Math.min(args.amount, currentSubscriptionPrice); // make sure we don't discount more than the current price
      return discount;
    }
    return 0;
  },
});

export const subscriptionPromotions = [
  allByPercentage,
  withFacetsByPercentage,
  withFacetsByFixedAmount,
  selectedProductsByFixedAmount,
  selectedProductsByPercentage,
];
