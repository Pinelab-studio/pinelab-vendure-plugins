import {
  RequestContext,
  OrderLine,
  Injector,
  ProductVariant,
} from '@vendure/core';
import { Subscription, SubscriptionStrategy } from './subscription-strategy';

/**
 * This strategy creates a subscription based on the product variant:
 * * The variant's price is the price per month
 * * Start date is one month from now, because we ask the customer to pay the first month during checkout
 */
export class DefaultSubscriptionStrategy implements SubscriptionStrategy {
  defineSubscription(
    ctx: RequestContext,
    injector: Injector,
    productVariant: ProductVariant,
    orderLineCustomFields: { [key: string]: any },
    quantity: number
  ): Subscription {
    return this.getSubscriptionForVariant(productVariant);
  }

  isSubscription(ctx: RequestContext, variant: ProductVariant): boolean {
    // This example treats all products as subscriptions
    return true;
  }

  previewSubscription(
    ctx: RequestContext,
    injector: Injector,
    productVariant: ProductVariant
  ): Subscription {
    return this.getSubscriptionForVariant(productVariant);
  }

  private getSubscriptionForVariant(
    productVariant: ProductVariant
  ): Subscription {
    const price = productVariant.listPrice;
    return {
      priceIncludesTax: productVariant.listPriceIncludesTax,
      amountDueNow: price,
      recurring: {
        amount: price,
        interval: 'month',
        intervalCount: 1,
        startDate: this.getOneMonthFromNow(),
      },
    };
  }

  private getOneMonthFromNow(): Date {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
}
