import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { settleWithoutPaymentHandler } from './settle-without-payment-handler';
import { settleWithoutPaymentChecker } from './settle-without-payment-checker';

@VendurePlugin({
  imports: [PluginCommonModule],
  configuration: (config) => {
    config.paymentOptions.paymentMethodHandlers.push(
      settleWithoutPaymentHandler
    );
    if (config.paymentOptions.paymentMethodEligibilityCheckers?.length) {
      config.paymentOptions.paymentMethodEligibilityCheckers.push(
        settleWithoutPaymentChecker
      );
    } else {
      config.paymentOptions.paymentMethodEligibilityCheckers = [
        settleWithoutPaymentChecker,
      ];
    }
    return config;
  },
})
export class PaymentExtensionsPlugin {}
