import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { KlaviyoService } from './klaviyo.service';
import {
  EventWithContext,
  KlaviyoEventHandler,
  KlaviyoOrderPlacedEventHandler,
} from './event-handler/klaviyo-event-handler';
import { defaultOrderPlacedEventHandler } from './event-handler/default-order-placed-event-handler';

interface KlaviyoPluginOptionsInput {
  /**
   * Private API key from your Klaviyo dashboard
   */
  apiKey: string;
  /**
   * Map a Vendure event to a Klaviyo event.
   */
  eventHandlers?: Array<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    KlaviyoOrderPlacedEventHandler | KlaviyoEventHandler<EventWithContext>
  >;
}

export type KlaviyoPluginOptions = Required<KlaviyoPluginOptionsInput>;

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => KlaviyoPlugin.options,
    },
    KlaviyoService,
  ],
})
export class KlaviyoPlugin {
  static options: KlaviyoPluginOptions;

  static init(options: KlaviyoPluginOptionsInput): typeof KlaviyoPlugin {
    this.options = {
      ...options,
      eventHandlers: options.eventHandlers ?? [defaultOrderPlacedEventHandler],
    };
    return KlaviyoPlugin;
  }
}
