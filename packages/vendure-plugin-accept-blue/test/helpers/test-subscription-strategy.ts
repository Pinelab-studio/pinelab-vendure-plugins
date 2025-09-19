import { Injector, Order, ProductVariant, RequestContext } from '@vendure/core';
import { Subscription, SubscriptionStrategy } from '../../src';

/**
 * Just a test subscription strategy for testing purposes.
 */
export class TestSubscriptionStrategy implements SubscriptionStrategy {
  defineSubscription(
    ctx: RequestContext,
    injector: Injector,
    productVariant: ProductVariant,
    order: Order,
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
    productVariant: ProductVariant,
    customInputs: any
  ): Subscription {
    return this.getSubscriptionForVariant(productVariant);
  }

  private getSubscriptionForVariant(
    productVariant: ProductVariant
  ): Subscription {
    return {
      name: `Test Subscription ${productVariant.name}`,
      priceIncludesTax: true,
      amountDueNow: productVariant.priceWithTax,
      recurring: {
        amount: 0,
        interval: 'week',
        intervalCount: 1,
        startDate: this.getTomorrow(),
      },
    };
  }

  private getTomorrow(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12);
  }
}
