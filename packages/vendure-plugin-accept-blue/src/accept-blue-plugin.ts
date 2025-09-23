import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { SubscriptionStrategy } from '../../util/src/subscription/subscription-strategy';
import { AcceptBlueService } from './service/accept-blue-service';
import { acceptBluePaymentHandler } from './service/accept-blue-handler';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { adminApiExtensions, shopApiExtensions } from './api/api-extensions';
import { AcceptBlueCommonResolver } from './api/accept-blue-common-resolvers';
import { AcceptBlueController } from './api/accept-blue-controller';
import { DefaultSubscriptionStrategy } from '../../util/src/subscription/default-subscription-strategy';
import { rawBodyMiddleware } from '../../util/src/raw-body.middleware';
import { AcceptBlueAdminResolver } from './api/accept-blue-admin-resolver';
import { SubscriptionOrderItemCalculation } from './service/subscription-order-item-calculation';

interface AcceptBluePluginOptionsInput {
  subscriptionStrategy?: SubscriptionStrategy;
  vendureHost: string;
  /**
   * Whether to send a receipt email to the customer via the Accept Blue platform.
   * Set this to false if you handle your own receipt emails.
   * Default is true.
   */
  sendReceiptEmail?: boolean;
}

export type AcceptBluePluginOptions = Required<AcceptBluePluginOptionsInput>;

@VendurePlugin({
  imports: [PluginCommonModule],
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [AcceptBlueCommonResolver, AcceptBlueAdminResolver],
  },
  shopApiExtensions: {
    schema: shopApiExtensions,
    resolvers: [AcceptBlueCommonResolver],
  },
  controllers: [AcceptBlueController],
  providers: [
    AcceptBlueService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => AcceptBluePlugin.options,
    },
  ],
  configuration: (config) => {
    config.paymentOptions.paymentMethodHandlers.push(acceptBluePaymentHandler);
    config.apiOptions.middleware.push({
      route: '/accept-blue/*splat',
      handler: rawBodyMiddleware,
      beforeListen: true,
    });
    config.customFields.OrderLine.push({
      name: 'acceptBlueSubscriptionIds',
      type: 'int',
      list: true,
      nullable: true,
      readonly: true,
    });
    config.customFields.Customer.push({
      name: 'acceptBlueCustomerId',
      nullable: true,
      readonly: true,
      type: 'int',
    });
    // Set the order item price calculation strategy, so that order line price is the price of the calculation
    config.orderOptions.orderItemPriceCalculationStrategy =
      new SubscriptionOrderItemCalculation();
    return config;
  },
  compatibility: '>=3.2.0',
})
export class AcceptBluePlugin {
  static options: AcceptBluePluginOptions;

  static init(options: AcceptBluePluginOptionsInput): Type<AcceptBluePlugin> {
    let vendureHost = options.vendureHost;
    // Strip trailing slash
    if (vendureHost.endsWith('/')) {
      vendureHost = vendureHost.slice(0, vendureHost.length - 1);
    }
    this.options = {
      subscriptionStrategy:
        options.subscriptionStrategy ?? new DefaultSubscriptionStrategy(),
      vendureHost,
      sendReceiptEmail: options.sendReceiptEmail ?? true,
    };
    return AcceptBluePlugin;
  }
}
