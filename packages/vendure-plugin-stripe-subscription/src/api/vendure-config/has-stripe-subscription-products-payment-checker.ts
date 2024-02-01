import {
  Injector,
  LanguageCode,
  Order,
  PaymentMethodEligibilityChecker,
} from '@vendure/core';
import { StripeSubscriptionService } from '../stripe-subscription.service';

let stripeSubscriptionService: StripeSubscriptionService;

export const hasStripeSubscriptionProductsPaymentChecker =
  new PaymentMethodEligibilityChecker({
    code: 'has-stripe-subscription-products-checker',
    description: [
      {
        languageCode: LanguageCode.en,
        value: 'Checks if the order has Subscription products.',
      },
    ],
    args: {},
    init: (injector: Injector) => {
      stripeSubscriptionService = injector.get(StripeSubscriptionService);
    },
    check: async (ctx, order, args) => {
      if (
        await stripeSubscriptionService.subscriptionHelper.hasSubscriptions(
          ctx,
          order
        )
      ) {
        return true;
      }
      return false;
    },
  });
