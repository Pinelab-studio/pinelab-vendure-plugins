import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { OrderCleanupService } from './service/order-cleanup.service';
import { OrderCleanupController } from './api/order-cleanup.controller';
import { ORDER_CLEANUP_OPTIONS } from './constants';
export interface OrderCleanupPluginOptions {
  /**
   * @description
   * Orders not updated in the given number of days will be cancelled
   */
  olderThanDays: number;
  /**
   * @description
   * Number of orders to cancel concurrently in each batch.
   * Reduce to 1 when using SQLite (e.g. in tests), since SQLite's single
   * connection cannot handle concurrent transactions.
   * @default 10
   */
  batchSize?: number;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    OrderCleanupService,
    {
      provide: ORDER_CLEANUP_OPTIONS,
      useFactory: () => OrderCleanupPlugin.options,
    },
  ],
  controllers: [OrderCleanupController],
  configuration: (config) => {
    return config;
  },
})
export class OrderCleanupPlugin {
  private static options: OrderCleanupPluginOptions = {
    olderThanDays: 30,
  };

  static init(options: OrderCleanupPluginOptions): Type<OrderCleanupPlugin> {
    OrderCleanupPlugin.options = options;
    return OrderCleanupPlugin;
  }
}
