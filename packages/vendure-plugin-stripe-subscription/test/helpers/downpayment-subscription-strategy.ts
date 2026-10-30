import { Injector, Order, ProductVariant, RequestContext } from '@vendure/core';
import { Subscription, SubscriptionStrategy } from '../../src';

/**
 * This strategy creates a monthly subscription + a recurring down payment based on the duration (12 by default) of the subscription:
 * * The variant's price is the price per month
 * * Down payment will be created as a subscription that renews every 12 months, based on the given duration
 */
export class DownPaymentSubscriptionStrategy implements SubscriptionStrategy {
  durationInMonths = 12;

  isSubscription(_ctx: RequestContext, _variant: ProductVariant): boolean {
    // This example treats all products as subscriptions
    return true;
  }

  defineSubscription(
    _ctx: RequestContext,
    _injector: Injector,
    productVariant: ProductVariant,
    _order: Order,
    orderLineCustomFields: { [key: string]: any },
    _quantity: number,
  ): Subscription[] {
    return this.getSubscriptionsForVariant(
      productVariant,
      orderLineCustomFields.subscriptionDownpayment,
      this.durationInMonths,
    );
  }

  previewSubscription(
    _ctx: RequestContext,
    _injector: Injector,
    productVariant: ProductVariant,
    customInputs: {
      subscriptionDownpayment: number;
    },
  ): Subscription[] {
    return this.getSubscriptionsForVariant(
      productVariant,
      customInputs.subscriptionDownpayment,
      this.durationInMonths,
    );
  }

  private getSubscriptionsForVariant(
    productVariant: ProductVariant,
    downpayment: number,
    durationInMonths: number,
  ): Subscription[] {
    const discountPerMonth = downpayment / durationInMonths;
    const subscriptions: Subscription[] = [];
    subscriptions.push({
      name: `Monthly subscription - ${productVariant.name}`,
      priceIncludesTax: productVariant.listPriceIncludesTax,
      amountDueNow: 0,
      recurring: {
        amount: productVariant.listPrice - discountPerMonth,
        interval: 'month',
        intervalCount: 1,
        startDate: new Date(),
      },
    });
    if (downpayment > 0) {
      subscriptions.push({
        name: `Downpayment subscription - ${productVariant.name}`,
        priceIncludesTax: productVariant.listPriceIncludesTax,
        amountDueNow: 0,
        recurring: {
          amount: downpayment,
          interval: 'month',
          intervalCount: durationInMonths,
          startDate: new Date(),
        },
      });
    }
    return subscriptions;
  }
}
