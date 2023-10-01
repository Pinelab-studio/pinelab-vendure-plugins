import {
  Injector,
  OrderLine,
  ProductVariant,
  RequestContext,
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
   * Determines if the given variant should be treated as a subscription, or as a regular product
   */
  isSubscription(ctx: RequestContext, variant: ProductVariant): boolean;

  /**
   * Define a subscription based on the given order line fields.
   * This is executed when an item is being added to cart
   */
  defineSubscription(
    ctx: RequestContext,
    injector: Injector,
    productVariant: ProductVariant,
    orderLineCustomFields: { [key: string]: any },
    quantity: number
  ): Promise<Subscription> | Subscription;

  /**
   * Preview subscription pricing for a given product variant, because there is no order line available during preview.
   * Optional custom inputs can be passed in via the Graphql query, for example to preview the subscription with a custom start Date
   *
   * This is use by the storefront to display subscription prices before they are actually added to cart
   */
  previewSubscription(
    ctx: RequestContext,
    injector: Injector,
    productVariant: ProductVariant,
    customInputs?: any
  ): Promise<Subscription> | Subscription;
}
