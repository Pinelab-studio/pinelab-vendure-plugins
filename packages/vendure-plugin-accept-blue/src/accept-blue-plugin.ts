import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { AcceptBlueService } from './api/accept-blue-service';
import { acceptBlueCreditCardHandler } from './api/credit-card-handler';

export interface StripeSubscriptionPluginOptions {
  subscriptionStrategy?: any;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [AcceptBlueService],
  configuration: (config) => {
    config.paymentOptions.paymentMethodHandlers.push(
      acceptBlueCreditCardHandler
    );
    return config;
  },
  compatibility: '^2.0.0',
})
export class AcceptBluePlugin {
  static init(options: any) {
    return AcceptBluePlugin;
  }
}
