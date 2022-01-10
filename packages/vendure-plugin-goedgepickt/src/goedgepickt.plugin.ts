import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { GoedgepicktService } from './goedgepickt.service';

export interface GoedgepicktConfig {
  configPerChannel: GoedgepicktChannelConfig[];
  /**
   * Needed for incoming webhooks from Goedgepickt
   */
  vendureHost: string;
}

/**
 * Channel specific configs like apiKey and webshopUuid per channel
 */
export interface GoedgepicktChannelConfig {
  channelToken: string;
  apiKey: string;
  webshopUuid: string;
}

export const GgLoggerContext = 'GoedgepicktPlugin';

@VendurePlugin({
  imports: [PluginCommonModule],
  // controllers: [],
  providers: [GoedgepicktService],
  /*  configuration: (config: RuntimeVendureConfig) => {
      config.shippingOptions.fulfillmentHandlers.push(goedgepicktHandler);
      return config;
    }*/
})
export class GoedgepicktPlugin {
  static config: GoedgepicktConfig;

  static init(config: GoedgepicktConfig): typeof GoedgepicktPlugin {
    this.config = config;
    return GoedgepicktPlugin;
  }
}
