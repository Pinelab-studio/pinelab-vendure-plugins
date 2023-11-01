import {
  RequestContext,
  OrderLine,
  Injector,
  ProductVariant,
  Order,
} from '@vendure/core';
import { Subscription, SubscriptionStrategy } from '../src/';

/**
 * This strategy creates a monthly subscription + a recurring down payment based on the duration of the subscription:
 * * The variant's price is the price per month
 * * Down payment will be created as a subscription that renews every X months, based on the given duration
 *
 * This strategy expects the customfields `subscriptionDownpayment` and `subscriptionDurationInMonths` to be set on the order line.
 *
 * For previewing subscriptions, the customInputs can be used: `customInputs: {subscriptionDownpayment: 100, subscriptionDuration: 12}`
 */
export class DownPaymentSubscriptionStrategy implements SubscriptionStrategy {
  isSubscription(ctx: RequestContext, variant: ProductVariant): boolean {
    // This example treats all products as subscriptions
    return true;
  }

  defineSubscription(
    ctx: RequestContext,
    injector: Injector,
    productVariant: ProductVariant,
    order: Order,
    orderLineCustomFields: { [key: string]: any },
    quantity: number
  ): Subscription[] {
    return this.getSubscriptionsForVariant(
      productVariant,
      orderLineCustomFields.subscriptionDownpayment,
      orderLineCustomFields.subscriptionDurationInMonths
    );
  }

  previewSubscription(
    ctx: RequestContext,
    injector: Injector,
    productVariant: ProductVariant,
    customInputs: {
      subscriptionDownpayment: number;
      subscriptionDurationInMonths: number;
    }
  ): Subscription[] {
    return this.getSubscriptionsForVariant(
      productVariant,
      customInputs.subscriptionDownpayment,
      customInputs.subscriptionDurationInMonths
    );
  }

  private getSubscriptionsForVariant(
    productVariant: ProductVariant,
    downpayment: number,
    durationInMonths: number
  ): Subscription[] {
    const discountPerMonth = downpayment / durationInMonths;
    return [
      {
        name: `Monthly subscription - ${productVariant.name}`,
        variantId: productVariant.id,
        priceIncludesTax: productVariant.listPriceIncludesTax,
        amountDueNow: 0,
        recurring: {
          amount: productVariant.listPrice - discountPerMonth,
          interval: 'month',
          intervalCount: 1,
          startDate: new Date(),
        },
      },
      {
        name: `Downpayment subscription - ${productVariant.name}`,
        variantId: productVariant.id,
        priceIncludesTax: productVariant.listPriceIncludesTax,
        amountDueNow: 0,
        recurring: {
          amount: downpayment,
          interval: 'month',
          intervalCount: durationInMonths,
          startDate: new Date(),
        },
      },
    ];
  }
}
