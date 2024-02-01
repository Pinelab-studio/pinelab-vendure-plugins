import {
  Injector,
  Order,
  OrderItemPriceCalculationStrategy,
  PriceCalculationResult,
  ProductVariant,
  RequestContext,
} from '@vendure/core';
import { DefaultOrderItemPriceCalculationStrategy } from '@vendure/core/dist/config/order/default-order-item-price-calculation-strategy';
import { CustomOrderLineFields } from '@vendure/core/dist/entity/custom-entity-fields';
import { StripeSubscriptionService } from './stripe-subscription.service';

let injector: Injector;

export class SubscriptionOrderItemCalculation
  extends DefaultOrderItemPriceCalculationStrategy
  implements OrderItemPriceCalculationStrategy
{
  init(_injector: Injector): void | Promise<void> {
    injector = _injector;
  }

  // @ts-ignore - Our strategy takes more arguments, so TS complains that it doesnt match the super.calculateUnitPrice
  async calculateUnitPrice(
    ctx: RequestContext,
    productVariant: ProductVariant,
    orderLineCustomFields: CustomOrderLineFields,
    order: Order,
    orderLineQuantity: number
  ): Promise<PriceCalculationResult> {
    const subcriptionService = injector.get(StripeSubscriptionService);
    if (!subcriptionService) {
      throw new Error('Subscription service not initialized');
    }
    if (
      !(await subcriptionService.subscriptionHelper.isSubscription(
        ctx,
        productVariant
      ))
    ) {
      return super.calculateUnitPrice(ctx, productVariant);
    }
    const subscription =
      await subcriptionService.subscriptionHelper.defineSubscription(
        ctx,
        productVariant,
        order,
        orderLineCustomFields,
        orderLineQuantity
      );
    if (!Array.isArray(subscription)) {
      return {
        priceIncludesTax: subscription.priceIncludesTax,
        price: subscription.amountDueNow ?? 0,
      };
    }
    if (!subscription.length) {
      throw Error(
        `Subscription strategy returned an empty array. Must contain atleast 1 subscription`
      );
    }
    const total = subscription.reduce((acc, sub) => acc + sub.amountDueNow, 0);
    return {
      priceIncludesTax: subscription[0].priceIncludesTax,
      price: total,
    };
  }
}
