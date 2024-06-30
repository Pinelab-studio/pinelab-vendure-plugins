import { Injector, Order, ProductVariant, RequestContext } from '@vendure/core';
import { Subscription, SubscriptionStrategy } from './subscription-strategy';

/**
 * This definietly needs to be renamed
 */
export class WebhookSubscriptionStrategy implements SubscriptionStrategy {
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
    const price = productVariant.listPrice;
    return {
      name: `Subscription ${productVariant.name}`,
      priceIncludesTax: productVariant.listPriceIncludesTax,
      amountDueNow: 0,
      recurring: {
        amount: price,
        interval: 'month',
        intervalCount: 1,
        startDate: new Date(),
      },
    };
  }
}
