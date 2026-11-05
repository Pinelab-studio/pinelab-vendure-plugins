import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { OrderIntegrationController } from './api/order-integration.controller';
import { rawBodyMiddleware } from './api/raw-body.middleware';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { OrderIntegrationService } from './services/order-integration.service';
import { OrderIntegrationPluginOptions } from './types';

/**
 * Connects orders and carts to external platforms through consumer-supplied strategies: lifecycle
 * hooks run as retried background jobs and inbound webhooks reach the owning strategy.
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  controllers: [OrderIntegrationController],
  providers: [
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => OrderIntegrationPlugin.options,
    },
    OrderIntegrationService,
  ],
  configuration: (config) => {
    config.apiOptions.middleware.push({
      route: '/order-integration/*splat',
      handler: rawBodyMiddleware,
      beforeListen: true,
    });
    return config;
  },
  compatibility: '>=3.3.0',
})
export class OrderIntegrationPlugin {
  static options: OrderIntegrationPluginOptions = { strategies: [] };

  /**
   * Registers the strategies and options. Throws when two strategies share a name,
   * because names route jobs and webhooks.
   */
  static init(
    options: OrderIntegrationPluginOptions,
  ): Type<OrderIntegrationPlugin> {
    const names = new Set<string>();
    for (const { name } of options.strategies) {
      if (names.has(name)) {
        throw new Error(
          `OrderIntegrationPlugin: duplicate strategy name '${name}'. Strategy names must be unique.`,
        );
      }
      names.add(name);
    }
    OrderIntegrationPlugin.options = { ...options };
    return OrderIntegrationPlugin;
  }
}
