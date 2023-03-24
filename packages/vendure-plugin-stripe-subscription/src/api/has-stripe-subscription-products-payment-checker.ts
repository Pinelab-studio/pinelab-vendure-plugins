import {
  LanguageCode,
  Order,
  PaymentMethodEligibilityChecker,
} from '@vendure/core';
import { OrderWithSubscriptionFields } from './subscription-custom-fields';

export function hasSubscriptions(order: Order): boolean {
  return (order as OrderWithSubscriptionFields).lines.some(
    (line) => line.productVariant.customFields.subscriptionSchedule
  );
}

export const hasStripeSubscriptionProductsPaymentChecker =
  new PaymentMethodEligibilityChecker({
    code: 'has-stripe-subscription-products-checker',
    description: [
      {
        languageCode: LanguageCode.en,
        value: 'Checks that the order has Stripe Subscription products.',
      },
    ],
    args: {},
    check: (ctx, order, args) => {
      if (hasSubscriptions(order)) {
        return true;
      }
      return false;
    },
  });
