import {
  ID,
  Injector,
  Order,
  OrderLine,
  ProductVariant,
  RequestContext,
} from '@vendure/core';

/**
 * Subscriptions can be created for Recurring payments or Recurring payments plus a one time payment
 */
export interface Subscription {
  /**
   * Name for displaying purposes
   */
  name: string;
  amountDueNow: number;
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
   * Determines if the given variant should be treated as a subscription, or as a regular product.
   * Try too keep this function as light as possible, because it is called for every product variant in the cart, every time the cart is updated.
   */
  isSubscription(
    ctx: RequestContext,
    variant: ProductVariant,
    injector: Injector
  ): boolean | Promise<boolean>;

  /**
   * Define a subscription based on the given order line fields.
   * Executed after payment has been added to order,
   * before subscriptions are created in Stripe
   */
  defineSubscription(
    ctx: RequestContext,
    injector: Injector,
    productVariant: ProductVariant,
    order: Order,
    orderLineCustomFields: { [key: string]: any },
    quantity: number
  ):
    | Promise<Subscription>
    | Subscription
    | Promise<Subscription[]>
    | Subscription[];

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
  ):
    | Promise<Subscription>
    | Subscription
    | Promise<Subscription[]>
    | Subscription[];
}
