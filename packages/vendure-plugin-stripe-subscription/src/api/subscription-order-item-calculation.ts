import {
  Injector,
  Order,
  OrderItemPriceCalculationStrategy,
  PriceCalculationResult,
  RequestContext,
} from '@vendure/core';
import { StripeSubscriptionService } from '../api/stripe-subscription.service';
import {
  OrderLineWithSubscriptionFields,
  VariantWithSubscriptionFields,
} from './subscription-custom-fields';
import { DefaultOrderItemPriceCalculationStrategy } from '@vendure/core/dist/config/order/default-order-item-price-calculation-strategy';

let subcriptionService: StripeSubscriptionService | undefined;

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
    productVariant: VariantWithSubscriptionFields,
    orderLineCustomFields: OrderLineWithSubscriptionFields['customFields'],
    order: Order
  ): Promise<PriceCalculationResult> {
    if (productVariant.customFields.subscriptionSchedule) {
      const pricing = await subcriptionService!.getPricingForVariant(ctx, {
        downpaymentWithTax: orderLineCustomFields.downpayment,
        startDate: orderLineCustomFields.startDate,
        productVariantId: productVariant.id as string,
      });
      return {
        price: pricing.amountDueNowWithTax,
        priceIncludesTax: true,
      };
    } else {
      return super.calculateUnitPrice(ctx, productVariant);
    }
  }
}
