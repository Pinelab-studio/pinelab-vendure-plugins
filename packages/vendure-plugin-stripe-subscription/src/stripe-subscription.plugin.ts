import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { stripeSubscriptionHandler } from './stripe-subscription.handler';
import { StripeSubscriptionService } from './stripe-subscription.service';
import {
  StripeSubscriptionController,
  ShopResolver,
  AdminResolver,
  ShopOrderLinePricingResolver,
} from './stripe-subscription.controller';
import { PLUGIN_INIT_OPTIONS } from './constants';
import {
  customerCustomFields,
  orderLineCustomFields,
  productVariantCustomFields,
} from './subscription-custom-fields';
import { createRawBodyMiddleWare } from '../../util/src/raw-body';
import { SubscriptionOrderItemCalculation } from './subscription-order-item-calculation';
import { Schedule } from './schedule.entity';
import { ScheduleService } from './schedule.service';
import path from 'path';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import { adminSchemaExtensions, shopSchemaExtensions } from './graphql-schemas';

export interface StripeSubscriptionPluginOptions {
  /**
   * Only use this for testing purposes, NEVER in production
   */
  disableWebhookSignatureChecking: boolean;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [Schedule],
  shopApiExtensions: {
    schema: shopSchemaExtensions,
    resolvers: [ShopResolver, ShopOrderLinePricingResolver],
  },
  adminApiExtensions: {
    schema: adminSchemaExtensions,
    resolvers: [AdminResolver],
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
    config.apiOptions.middleware.push(
      createRawBodyMiddleWare('/stripe-subscription*')
    );
    config.orderOptions.orderItemPriceCalculationStrategy =
      new SubscriptionOrderItemCalculation();
    config.customFields.ProductVariant.push(...productVariantCustomFields);
    config.customFields.Customer.push(...customerCustomFields);
    config.customFields.OrderLine.push(...orderLineCustomFields);
    return config;
  },
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
        route: 'subscription-schedules',
        ngModuleFileName: 'schedules.module.ts',
        ngModuleName: 'SchedulesModule',
      },
      {
        type: 'shared',
        ngModuleFileName: 'schedules-shared.module.ts',
        ngModuleName: 'SchedulesSharedModule',
      },
    ],
  };
}
