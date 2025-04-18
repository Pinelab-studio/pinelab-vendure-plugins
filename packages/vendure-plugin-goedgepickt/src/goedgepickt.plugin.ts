import {
  CustomOrderFields,
  PluginCommonModule,
  RuntimeVendureConfig,
  VendurePlugin,
} from '@vendure/core';
import { GoedgepicktService } from './api/goedgepickt.service';
import { GoedgepicktController } from './api/goedgepickt.controller';
import { goedgepicktHandler } from './api/goedgepickt.handler';
import { GoedgepicktPluginConfig } from './api/goedgepickt.types';
import {
  GoedgepicktResolver,
  goedgepicktPermission,
} from './api/goedgepickt.resolver';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { schema } from './api/schema.graphql';
import path from 'path';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
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

    return config;
  },
  compatibility: '>=2.2.0',
})
export class GoedgepicktPlugin {
  static config: GoedgepicktPluginConfig;

  static init(config: GoedgepicktPluginConfig): typeof GoedgepicktPlugin {
    this.config = config;
    if (this.config.setWebhook !== false) {
      this.config.setWebhook = true; // If not explicitly set to false, set to true
    }
    return GoedgepicktPlugin;
  }

  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    ngModules: [
      {
        type: 'shared',
        ngModuleFileName: 'goedgepickt-nav.module.ts',
        ngModuleName: 'GoedgepicktNavModule',
      },
    ],
  };
}
