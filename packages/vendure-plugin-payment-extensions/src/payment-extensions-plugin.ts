import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { settleWithoutPaymentHandler } from './settle-without-payment-handler';
import { isCustomerInGroupPaymentChecker } from './is-customer-In-group-payment-checker';

@VendurePlugin({
  imports: [PluginCommonModule],
  configuration: (config) => {
    config.paymentOptions.paymentMethodHandlers.push(
      settleWithoutPaymentHandler
    );
    if (config.paymentOptions.paymentMethodEligibilityCheckers?.length) {
      config.paymentOptions.paymentMethodEligibilityCheckers.push(
        isCustomerInGroupPaymentChecker
      );
    } else {
      config.paymentOptions.paymentMethodEligibilityCheckers = [
        isCustomerInGroupPaymentChecker,
      ];
    }
    return config;
  },
  compatibility: '>=2.2.0',
})
export class PaymentExtensionsPlugin {}
