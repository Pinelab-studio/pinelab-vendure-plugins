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
import { StripeSubscriptionPayment } from '../api/stripe-subscription-payment.entity';
import { OneTimePayment } from './strategy/subscription-strategy';
import { StripeSubscriptionService } from './stripe-subscription.service';

let subcriptionService: StripeSubscriptionService | undefined;
let injector: Injector;

export class SubscriptionOrderItemCalculation
  extends DefaultOrderItemPriceCalculationStrategy
  implements OrderItemPriceCalculationStrategy
{
  init(injector: Injector): void | Promise<void> {
    subcriptionService = injector.get(StripeSubscriptionService);
  }

  // @ts-ignore - Our strategy takes more arguments, so TS complains that it doesnt match the super.calculateUnitPrice
  async calculateUnitPrice(
    ctx: RequestContext,
    productVariant: ProductVariant,
    orderLineCustomFields: CustomOrderLineFields,
    order: Order,
    orderLineQuantity: number
  ): Promise<PriceCalculationResult> {
    if (!subcriptionService) {
      throw new Error('Subscription service not initialized');
    }
    if (subcriptionService.strategy.isSubscription(ctx, productVariant)) {
      const subscription = await subcriptionService.strategy.defineSubscription(
        ctx,
        injector,
        productVariant,
        orderLineCustomFields,
        orderLineQuantity
      );
      return {
        priceIncludesTax: subscription.priceIncludesTax,
        price: (subscription as OneTimePayment).amountDueNow ?? 0,
      };
    } else {
      return super.calculateUnitPrice(ctx, productVariant);
    }
  }
}
