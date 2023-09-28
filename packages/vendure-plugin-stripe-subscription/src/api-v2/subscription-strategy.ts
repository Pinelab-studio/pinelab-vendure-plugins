import {
  OrderLine,
  RequestContext,
  Injector,
  ProductVariant,
} from '@vendure/core';

/**
 * Subscriptions can be created for One time payments, Recurring payments or a combination of the two
 */
export type Subscription =
  | OneTimePayment
  | RecurringPayment
  | (OneTimePayment & RecurringPayment);

export interface OneTimePayment {
  priceIncludesTax: boolean;
  amountDueNow: number;
}

export interface RecurringPayment {
  priceIncludesTax: boolean;
  recurring: {
    amount: number;
    interval: 'week' | 'month' | 'year';
    intervalCount: number;
    startDate: Date;
    endDate?: Date;
  };
}

export interface SubscriptionStrategy {
  /**
   * Define a subscription based on the given order line.
   * This is executed when an item is being added to cart
   */
  defineSubscription(
    ctx: RequestContext,
    injector: Injector,
    orderLine: OrderLine
  ): Promise<Subscription> | Subscription;

  /**
   * Preview subscription pricing for a given product variant, because there is no order line available during preview.
   * Optional custom inputs can be passed in via the Graphql query, to, for example, preview the subscription with a custom start Date
   * This is use by the storefront to display subscription prices before they are actually added to cart
   */
  previewSubscription(
    ctx: RequestContext,
    injector: Injector,
    productVariant: ProductVariant,
    customInputs?: any
  ): Promise<Subscription> | Subscription;
}
