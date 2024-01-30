import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import { adminApiExtension } from './api/api.extension';
import { AdminApiResolver } from './api/api.resolver';
import { OrderTransitionListenerService } from './api/order-transition-listener.service';
import { convertToDraftButton } from './ui';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { convertToDraft } from './custom-order-process';

export interface ModifyCustomerOrdersPluginOptions {
  /**
   * Automatically connect draft orders as active order to the customer,
   * when you click `Complete draft` in the admin ui
   */
  autoAssignDraftOrdersToCustomer: boolean;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  adminApiExtensions: {
    resolvers: [AdminApiResolver],
    schema: adminApiExtension,
  },
  providers: [
    OrderTransitionListenerService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => ModifyCustomerOrdersPlugin.options,
    },
  ],
  configuration: (config) => {
    config.orderOptions.process.push(convertToDraft);
    return config;
  },
  compatibility: '^2.0.0',
})
export class ModifyCustomerOrdersPlugin {
  static options: ModifyCustomerOrdersPluginOptions = {
    autoAssignDraftOrdersToCustomer: false,
  };
  static ui: AdminUiExtension = convertToDraftButton;
  static init(
    options: ModifyCustomerOrdersPluginOptions
  ): typeof ModifyCustomerOrdersPlugin {
    this.options = options;
    return ModifyCustomerOrdersPlugin;
  }
}
