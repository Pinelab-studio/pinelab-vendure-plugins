import {
  PluginCommonModule,
  ProductVariant,
  RequestContext,
  VendurePlugin,
} from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { defaultOrderPlacedEventHandler } from './event-handler/default-order-placed-event-handler';
import {
  KlaviyoEventHandler,
  KlaviyoOrderPlacedEventHandler,
} from './event-handler/klaviyo-event-handler';
import { KlaviyoService } from './service/klaviyo.service';
import { KlaviyoShopResolver } from './api/klaviyo-shop-resolver';
import { shopApiExtensions } from './api/api-extensions';
import { startedCheckoutHandler } from './event-handler/checkout-started-event-handler';
import { KlaviyoProductFeedItem } from './types';

export interface KlaviyoPluginOptions {
  /**
   * Private API key from your Klaviyo dashboard
   */
  apiKey: string | ((ctx: RequestContext) => string | undefined);
  /**
   * Map a Vendure event to a Klaviyo event.
   */
  eventHandlers?: Array<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    KlaviyoOrderPlacedEventHandler | KlaviyoEventHandler<any>
  >;
  feed?: {
    /**
     * Klaviyo feed password. We want to expose the feed via the Shop API, as it is is shop data.
     * We also don't want to have to authenticate our frontend builds, so we use a password.
     */
    password?: string;
    /**
     * This function allows you to enhance the product feed item with additional data.
     * This is mandatory, because you should at least construct the storefront URL and image URL.
     */
    enhanceProductFeedItemFn: (
      ctx: RequestContext,
      variant: ProductVariant,
      feedItem: Omit<KlaviyoProductFeedItem, 'image_link' | 'link'>
    ) => KlaviyoProductFeedItem & Record<string, unknown>;
  };
}

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => KlaviyoPlugin.options,
    },
    KlaviyoService,
  ],
  shopApiExtensions: {
    resolvers: [KlaviyoShopResolver],
    schema: shopApiExtensions,
  },
  compatibility: '>=2.2.0',
})
export class KlaviyoPlugin {
  static options: KlaviyoPluginOptions;

  static init(options: KlaviyoPluginOptions): typeof KlaviyoPlugin {
    this.options = {
      ...options,
      eventHandlers: options.eventHandlers ?? [
        defaultOrderPlacedEventHandler,
        startedCheckoutHandler,
      ],
    };
    return KlaviyoPlugin;
  }
}
