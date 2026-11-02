import {
  PluginCommonModule,
  RuntimeVendureConfig,
  VendurePlugin,
} from '@vendure/core';
import { GoedgepicktController } from './api/goedgepickt.controller';
import { goedgepicktHandler } from './api/goedgepickt.handler';
import {
  GoedgepicktResolver,
  goedgepicktPermission,
} from './api/goedgepickt.resolver';
import { GoedgepicktService } from './api/goedgepickt.service';
import { GoedgepicktPluginConfig } from './api/goedgepickt.types';
import { schema } from './api/schema.graphql';
import {
  goedgepicktPushProductsTask,
  goedgepicktSyncStockTask,
} from './config/goedgepickt-scheduled-task';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { channelCustomFields, orderCustomFields } from './custom-fields';

@VendurePlugin({
  imports: [PluginCommonModule],
  controllers: [GoedgepicktController],
  providers: [
    GoedgepicktService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => GoedgepicktPlugin.config,
    },
  ],
  adminApiExtensions: {
    schema,
    resolvers: [GoedgepicktResolver],
  },
  configuration: (config: RuntimeVendureConfig) => {
    config.shippingOptions.fulfillmentHandlers.push(goedgepicktHandler);
    config.authOptions.customPermissions.push(goedgepicktPermission);
    config.customFields.Order.push(...orderCustomFields);
    config.customFields.Channel.push(...channelCustomFields);
    config.schedulerOptions.tasks.push(goedgepicktSyncStockTask);
    config.schedulerOptions.tasks.push(goedgepicktPushProductsTask);

    return config;
  },
  dashboard: './dashboard/index.tsx',
  compatibility: '>=2.2.0',
})
export class GoedgepicktPlugin {
  static config: GoedgepicktPluginConfig;

  static init(config: GoedgepicktPluginConfig): typeof GoedgepicktPlugin {
    GoedgepicktPlugin.config = config;
    if (GoedgepicktPlugin.config.setWebhook !== false) {
      GoedgepicktPlugin.config.setWebhook = true; // If not explicitly set to false, set to true
    }
    return GoedgepicktPlugin;
  }
}
