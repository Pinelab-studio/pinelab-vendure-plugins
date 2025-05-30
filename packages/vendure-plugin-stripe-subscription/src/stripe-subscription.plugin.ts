import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { DefaultSubscriptionStrategy, SubscriptionStrategy } from './';
import path from 'path';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import { orderLineCustomFields } from './api/vendure-config/custom-fields';
import { stripeSubscriptionHandler } from './api/vendure-config/stripe-subscription.handler';
import { hasStripeSubscriptionProductsPaymentChecker } from './api/vendure-config/has-stripe-subscription-products-payment-checker';
import { SubscriptionOrderItemCalculation } from './api/subscription-order-item-calculation';
import { StripeSubscriptionService } from './api/stripe-subscription.service';
import { StripeSubscriptionController } from './api/stripe-subscription.controller';
import {
  StripeSubscriptionAdminApiResolver,
  StripeSubscriptionCommonResolver,
  StripeSubscriptionShopApiResolver,
} from './api/stripe-subscription.resolver';
import { shopApiSchemaExtensions } from './api/shop-graphql';
import { adminApiSchemaExtensions } from './api/admin-graphql';

export interface StripeSubscriptionPluginOptions {
  vendureHost: string;
  subscriptionStrategy?: SubscriptionStrategy;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  shopApiExtensions: {
    schema: shopApiSchemaExtensions,
    resolvers: [
      StripeSubscriptionCommonResolver,
      StripeSubscriptionShopApiResolver,
    ],
  },
  adminApiExtensions: {
    schema: adminApiSchemaExtensions,
    resolvers: [
      StripeSubscriptionCommonResolver,
      StripeSubscriptionAdminApiResolver,
    ],
  },
  controllers: [StripeSubscriptionController],
  providers: [
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => StripeSubscriptionPlugin.options,
    },
    StripeSubscriptionService,
  ],
  configuration: (config) => {
    config.paymentOptions.paymentMethodHandlers.push(stripeSubscriptionHandler);
    config.paymentOptions.paymentMethodEligibilityCheckers = [
      ...(config.paymentOptions.paymentMethodEligibilityCheckers ?? []),
      hasStripeSubscriptionProductsPaymentChecker,
    ];
    config.customFields.OrderLine.push(...orderLineCustomFields);

    config.orderOptions.orderItemPriceCalculationStrategy =
      new SubscriptionOrderItemCalculation();
    return config;
  },
  compatibility: '>=2.2.0',
})
export class StripeSubscriptionPlugin {
  static options: StripeSubscriptionPluginOptions = {
    vendureHost: '',
    subscriptionStrategy: new DefaultSubscriptionStrategy(),
  };

  static init(options: StripeSubscriptionPluginOptions) {
    this.options = {
      ...this.options,
      ...options,
    };
    return StripeSubscriptionPlugin;
  }

  static ui: AdminUiExtension = {
    id: 'stripe-subscription-extension',
    extensionPath: path.join(__dirname, 'ui'),
    ngModules: [
      {
        type: 'shared',
        ngModuleFileName: 'stripe-subscription-shared.module.ts',
        ngModuleName: 'StripeSubscriptionSharedModule',
      },
    ],
  };
}
