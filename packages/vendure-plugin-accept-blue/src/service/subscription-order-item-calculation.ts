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
import { AcceptBlueService } from './accept-blue-service';

let injector: Injector;

export class SubscriptionOrderItemCalculation
  extends DefaultOrderItemPriceCalculationStrategy
  implements OrderItemPriceCalculationStrategy
{
  init(_injector: Injector): void | Promise<void> {
    injector = _injector;
  }

  // @ts-expect-error - Our strategy takes more arguments than the super class. These arguments are coming from the interface, so this is valid
  async calculateUnitPrice(
    ctx: RequestContext,
    productVariant: ProductVariant,
    orderLineCustomFields: CustomOrderLineFields,
    order: Order,
    orderLineQuantity: number
  ): Promise<PriceCalculationResult> {
    const subscriptionService = injector.get(AcceptBlueService);
    if (!subscriptionService) {
      throw new Error('Subscription service not initialized');
    }
    if (
      !(await subscriptionService.subscriptionHelper.isSubscription(
        ctx,
        productVariant
      ))
    ) {
      return super.calculateUnitPrice(ctx, productVariant);
    }
    const subscription =
      await subscriptionService.subscriptionHelper.defineSubscription(
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
        `Subscription strategy returned an empty array. Must contain at least 1 subscription`
      );
    }
    const total = subscription.reduce((acc, sub) => acc + sub.amountDueNow, 0);
    return {
      priceIncludesTax: subscription[0].priceIncludesTax,
      price: total,
    };
  }
}
