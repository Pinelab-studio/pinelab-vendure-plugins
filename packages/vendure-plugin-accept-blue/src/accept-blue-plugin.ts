import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { DefaultSubscriptionStrategy } from '.';
import { SubscriptionStrategy } from '../../util/src/subscription/subscription-strategy';
import { AcceptBlueService } from './api/accept-blue-service';
import { acceptBlueCreditCardHandler } from './api/credit-card-handler';
import { PLUGIN_INIT_OPTIONS } from './constants';

interface AcceptBluePluginOptionsInput {
  subscriptionStrategy?: SubscriptionStrategy;
}

export type AcceptBluePluginOptions = Required<AcceptBluePluginOptionsInput>;

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    AcceptBlueService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => AcceptBluePlugin.options,
    },
  ],
  configuration: (config) => {
    config.paymentOptions.paymentMethodHandlers.push(
      acceptBlueCreditCardHandler
    );
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
