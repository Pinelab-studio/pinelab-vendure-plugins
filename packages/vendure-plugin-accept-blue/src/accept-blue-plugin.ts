import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { DefaultSubscriptionStrategy } from '.';
import { SubscriptionStrategy } from '../../util/src/subscription/subscription-strategy';
import { AcceptBlueService } from './api/accept-blue-service';
import { acceptBluePaymentHandler } from './api/accept-blue-handler';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { commonApiExtensions } from './api/api-extensions';
import { AcceptBlueCommonResolver } from './api/accept-blue-common-resolvers';

interface AcceptBluePluginOptionsInput {
  subscriptionStrategy?: SubscriptionStrategy;
}

export type AcceptBluePluginOptions = Required<AcceptBluePluginOptionsInput>;

@VendurePlugin({
  imports: [PluginCommonModule],
  adminApiExtensions: {
    schema: commonApiExtensions,
    resolvers: [AcceptBlueCommonResolver],
  },
  shopApiExtensions: {
    schema: commonApiExtensions,
    resolvers: [AcceptBlueCommonResolver],
  },
  providers: [
    AcceptBlueService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => AcceptBluePlugin.options,
    },
  ],
  configuration: (config) => {
    config.paymentOptions.paymentMethodHandlers.push(acceptBluePaymentHandler);
    config.customFields.OrderLine.push({
      name: 'subscriptionIds',
      type: 'int',
      list: true,
    });
    config.customFields.Customer.push({
      name: 'acceptBlueCustomerId',
      type: 'int',
    });
    return config;
  },
  compatibility: '^2.0.0',
})
export class AcceptBluePlugin {
  static options: AcceptBluePluginOptions = {
    subscriptionStrategy: new DefaultSubscriptionStrategy(),
  };

  static init(options: AcceptBluePluginOptionsInput): AcceptBluePlugin {
    this.options = {
      ...this.options,
      ...options,
    };
    return AcceptBluePlugin;
  }
}
