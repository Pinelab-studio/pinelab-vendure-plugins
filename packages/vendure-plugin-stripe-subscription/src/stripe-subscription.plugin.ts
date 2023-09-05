import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from './constants';
import {
  customerCustomFields,
  orderLineCustomFields,
  productVariantCustomFields,
} from './api/subscription-custom-fields';
import { createRawBodyMiddleWare } from '../../util/src/raw-body';
import { SubscriptionOrderItemCalculation } from './api/subscription-order-item-calculation';
import { Schedule } from './api/schedule.entity';
import { ScheduleService } from './api/schedule.service';
import path from 'path';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import {
  adminSchemaExtensions,
  shopSchemaExtensions,
} from './api/graphql-schemas';
import {
  AdminPriceIncludesTaxResolver,
  AdminResolver,
  OrderLinePricingResolver,
  ShopResolver,
  StripeSubscriptionController,
} from './api/stripe-subscription.controller';
import { StripeSubscriptionService } from './api/stripe-subscription.service';
import { stripeSubscriptionHandler } from './api/stripe-subscription.handler';
import { hasStripeSubscriptionProductsPaymentChecker } from './api/has-stripe-subscription-products-payment-checker';
import { subscriptionPromotions } from './api/subscription.promotion';
import { StripeSubscriptionPayment } from './api/stripe-subscription-payment.entity';

export interface StripeSubscriptionPluginOptions {
  /**
   * Only use this for testing purposes, NEVER in production
   */
  disableWebhookSignatureChecking: boolean;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [Schedule, StripeSubscriptionPayment],
  shopApiExtensions: {
    schema: shopSchemaExtensions,
    resolvers: [ShopResolver, OrderLinePricingResolver],
  },
  adminApiExtensions: {
    schema: adminSchemaExtensions,
    resolvers: [
      AdminResolver,
      AdminPriceIncludesTaxResolver,
      OrderLinePricingResolver,
    ],
  },
  controllers: [StripeSubscriptionController],
  providers: [
    StripeSubscriptionService,
    ScheduleService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => StripeSubscriptionPlugin.options,
    },
  ],
  configuration: (config) => {
    config.paymentOptions.paymentMethodHandlers.push(stripeSubscriptionHandler);
    config.paymentOptions.paymentMethodEligibilityCheckers = [
      ...(config.paymentOptions.paymentMethodEligibilityCheckers ?? []),
      hasStripeSubscriptionProductsPaymentChecker,
    ];
    config.apiOptions.middleware.push(
      createRawBodyMiddleWare('/stripe-subscription*')
    );
    config.orderOptions.orderItemPriceCalculationStrategy =
      new SubscriptionOrderItemCalculation();
    config.customFields.ProductVariant.push(...productVariantCustomFields);
    config.customFields.Customer.push(...customerCustomFields);
    config.customFields.OrderLine.push(...orderLineCustomFields);
    config.promotionOptions.promotionActions.push(...subscriptionPromotions);
    return config;
  },
  compatibility: '^2.0.0',
})
export class StripeSubscriptionPlugin {
  static options: StripeSubscriptionPluginOptions;

  static init(options: StripeSubscriptionPluginOptions) {
    this.options = options;
    return StripeSubscriptionPlugin;
  }

  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    ngModules: [
      {
        type: 'lazy',
        route: 'stripe',
        ngModuleFileName: 'stripe-subscription.module.ts',
        ngModuleName: 'SchedulesModule',
      },
      {
        type: 'shared',
        ngModuleFileName: 'stripe-subscription-shared.module.ts',
        ngModuleName: 'StripeSubscriptionSharedModule',
      },
    ],
  };
}
