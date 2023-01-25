import {
  Injector,
  Order,
  OrderItemPriceCalculationStrategy,
  PriceCalculationResult,
  RequestContext,
} from '@vendure/core';
import { StripeSubscriptionService } from './stripe-subscription.service';
import {
  OrderLineWithSubscriptionFields,
  VariantWithSubscriptionFields,
} from './subscription-custom-fields';

let subcriptionService: StripeSubscriptionService | undefined;

export class SubscriptionOrderItemCalculation
  implements OrderItemPriceCalculationStrategy
{
  init(injector: Injector): void | Promise<void> {
    subcriptionService = injector.get(StripeSubscriptionService);
  }

  async calculateUnitPrice(
    ctx: RequestContext,
    productVariant: VariantWithSubscriptionFields,
    orderLineCustomFields: OrderLineWithSubscriptionFields['customFields'],
    order: Order
  ): Promise<PriceCalculationResult> {
    if (productVariant.customFields.subscriptionSchedule) {
      const pricing = await subcriptionService!.getPricing(
        ctx,
        {
          downpayment: orderLineCustomFields.downpayment,
          startDate: orderLineCustomFields.startDate,
        },
        productVariant
      );
      return {
        price: pricing.amountDueNow,
        priceIncludesTax: false,
      };
    } else {
      return {
        price: productVariant.listPrice,
        priceIncludesTax: productVariant.listPriceIncludesTax,
      };
    }
  }
}
