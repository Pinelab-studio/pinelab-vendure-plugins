import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { SubscriptionStrategy } from './api-v2/subscription-strategy';
import { shopSchemaExtensions } from './api-v2/graphql-schema';
import { createRawBodyMiddleWare } from '../../util/src/raw-body';
import { DefaultSubscriptionStrategy } from './api-v2/default-subscription-strategy';

export interface StripeSubscriptionPluginOptions {
  /**
   * Only use this for testing purposes, NEVER in production
   */
  disableWebhookSignatureChecking?: boolean;
  subscriptionStrategy?: SubscriptionStrategy;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  shopApiExtensions: {
    schema: shopSchemaExtensions,
    resolvers: [],
  },
  controllers: [],
  providers: [
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => StripeSubscriptionPlugin.options,
    },
  ],
  configuration: (config) => {
    // FIXME config.paymentOptions.paymentMethodHandlers.push(stripeSubscriptionHandler);
    // FIXME config.paymentOptions.paymentMethodEligibilityCheckers = [
    //   ...(config.paymentOptions.paymentMethodEligibilityCheckers ?? []),
    //   hasStripeSubscriptionProductsPaymentChecker,
    // ];
    config.apiOptions.middleware.push(
      createRawBodyMiddleWare('/stripe-subscription*')
    );
    // FIXME config.orderOptions.orderItemPriceCalculationStrategy =
    //   new SubscriptionOrderItemCalculation();
    return config;
  },
  compatibility: '^2.0.0',
})
export class StripeSubscriptionPlugin {
  static options: StripeSubscriptionPluginOptions = {
    disableWebhookSignatureChecking: false,
    subscriptionStrategy: new DefaultSubscriptionStrategy(),
  };

  static init(options: StripeSubscriptionPluginOptions) {
    this.options = {
      ...this.options,
      ...options,
    };
    return StripeSubscriptionPlugin;
  }
}
