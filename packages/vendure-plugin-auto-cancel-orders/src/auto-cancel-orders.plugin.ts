import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { AutoCancelOrdersService } from './service/auto-cancel-orders.service';
import { AutoCancelOrdersController } from './api/auto-cancel-orders.controller';
import { AUTO_CANCEL_ORDERS_OPTIONS } from './constants';
export interface AutoCancelOrdersOptions {
  /**
   * @description
   * Orders not updated in the given number of days will be cancelled
   */
  olderThanDays: number;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    AutoCancelOrdersService,
    {
      provide: AUTO_CANCEL_ORDERS_OPTIONS,
      useFactory: () => AutoCancelOrdersPlugin.options,
    },
  ],
  controllers: [AutoCancelOrdersController],
  configuration: (config) => {
    return config;
  },
})
export class AutoCancelOrdersPlugin {
  private static options: AutoCancelOrdersOptions = {
    olderThanDays: 30,
  };

  static init(options: AutoCancelOrdersOptions): Type<AutoCancelOrdersPlugin> {
    AutoCancelOrdersPlugin.options = options;
    return AutoCancelOrdersPlugin;
  }
}
