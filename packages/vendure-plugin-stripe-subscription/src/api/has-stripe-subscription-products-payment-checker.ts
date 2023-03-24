import { LanguageCode, PaymentMethodEligibilityChecker } from '@vendure/core';
import { OrderWithSubscriptionFields } from './subscription-custom-fields';

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
      if (
        (order as OrderWithSubscriptionFields).lines.some(
          (line) => line.productVariant.customFields.subscriptionSchedule
        )
      ) {
        return true;
      }
      return false;
    },
  });
