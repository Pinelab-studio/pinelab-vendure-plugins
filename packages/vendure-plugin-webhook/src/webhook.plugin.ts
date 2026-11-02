import { PluginCommonModule, type Type, VendurePlugin } from '@vendure/core';
import { adminSchema } from './api/api-extension';
import type {
  EventWithContext,
  RequestTransformer,
} from './api/request-transformer';
import { Webhook } from './api/webhook.entity';
import {
  WebhookRequestTransformerResolver,
  WebhookResolver,
  webhookPermission,
} from './api/webhook.resolver';
import { WebhookService } from './api/webhook.service';
import { PLUGIN_INIT_OPTIONS } from './constants';

export interface WebhookPluginOptions {
  /**
   * The plugin will listen to these events and call the corresponding webhooks
   */
  events: Type<EventWithContext>[];
  /**
   * A list of available transformers to create custom body and headers for webhook requests
   */
  requestTransformers?: Array<RequestTransformer<Type<EventWithContext>[]>>;
  /**
   * Wait for more of the same events before calling webhook, and only call the configured webhook once.
   * E.g: With `delay: 100` only 1 call to your webhook will be done,
   * even if 10 of the same events are fired within 100ms.
   *
   * Delay is in ms
   */
  delay?: number;
  /**
   * Disable the plugin. Default is false
   */
  disabled?: boolean;
}

/**
 * Calls a configurable webhook when configured events arise.
 * 1 webhook per channel is configurable
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [Webhook],
  providers: [
    WebhookService,
    { provide: PLUGIN_INIT_OPTIONS, useFactory: () => WebhookPlugin.options },
  ],
  adminApiExtensions: {
    schema: adminSchema,
    resolvers: [WebhookResolver, WebhookRequestTransformerResolver],
  },
  configuration: (config) => {
    config.authOptions.customPermissions.push(webhookPermission);
    return config;
  },
  compatibility: '>=2.2.0',
})
export class WebhookPlugin {
  static options: WebhookPluginOptions = {
    events: [],
    delay: 0,
  };

  static init(options: WebhookPluginOptions): typeof WebhookPlugin {
    WebhookPlugin.options = {
      ...WebhookPlugin.options,
      ...options,
    };
    return WebhookPlugin;
  }
}
