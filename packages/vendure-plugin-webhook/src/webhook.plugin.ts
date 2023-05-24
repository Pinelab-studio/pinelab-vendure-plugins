import { PluginCommonModule, VendureEvent, VendurePlugin } from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { WebhookPerChannelEntity } from './api/webhook-per-channel.entity';
import { schema } from './api/schema';
import {
  WebhookPluginOptions,
  WebhookRequestFn,
} from './api/webhook-plugin-options';
import { WebhookResolver } from './api/webhook.resolver';
import { WebhookService } from './api/webhook.service';
import { webhookPermission } from './index';
import { PLUGIN_INIT_OPTIONS } from './constants';

/**
 * Calls a configurable webhook when configured events arise.
 * 1 webhook per channel is configurable
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [WebhookPerChannelEntity],
  providers: [
    WebhookService,
    { provide: PLUGIN_INIT_OPTIONS, useFactory: () => WebhookPlugin.options }
  ],
  adminApiExtensions: {
    schema,
    resolvers: [WebhookResolver],
  },
  configuration: (config) => {
    config.authOptions.customPermissions.push(webhookPermission);
    return config;
  },
})
export class WebhookPlugin {``
  static options: WebhookPluginOptions<any>;

  static init<T extends VendureEvent>(
    options: WebhookPluginOptions<T>
  ): typeof WebhookPlugin {
    this.options = options;
    return WebhookPlugin;
  }

  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    ngModules: [
      {
        type: 'lazy',
        route: 'webhook',
        ngModuleFileName: 'webhook.module.ts',
        ngModuleName: 'WebhookModule',
      },
      {
        type: 'shared',
        ngModuleFileName: 'webhook-nav.module.ts',
        ngModuleName: 'WebhookNavModule',
      },
    ],
  };
}
