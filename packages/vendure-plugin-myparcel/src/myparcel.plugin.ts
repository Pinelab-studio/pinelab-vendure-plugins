import {
  PluginCommonModule,
  RuntimeVendureConfig,
  VendurePlugin,
} from '@vendure/core';
import { myparcelHandler } from './myparcel.handler';
import { MyparcelService } from './myparcel.service';

@VendurePlugin({
  imports: [PluginCommonModule],
  controllers: [],
  providers: [MyparcelService],
  configuration: (config: RuntimeVendureConfig) => {
    config.shippingOptions.fulfillmentHandlers.push(myparcelHandler);
    return config;
  },
})
export class MyparcelPlugin {
  static loggerCtx = 'MyParcelPlugin';
  static apiKeys: MyParcelApiKeys;
  static webhookHost: string;

  static init(apiKeys: MyParcelApiKeys, vendureHost: string): typeof MyparcelPlugin {
    this.apiKeys = apiKeys;
    this.webhookHost = vendureHost;
    return MyparcelPlugin;
  }
}

/**
 * ChannelToken: ApiKey
 */
export interface MyParcelApiKeys {
  [key: string]: string;
}
