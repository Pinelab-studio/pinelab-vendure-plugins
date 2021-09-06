import {
  PluginCommonModule,
  RuntimeVendureConfig,
  VendurePlugin,
} from '@vendure/core';
import { myparcelHandler } from './myparcel.handler';

@VendurePlugin({
  imports: [PluginCommonModule],
  controllers: [],
  providers: [],
  configuration: (config: RuntimeVendureConfig) => {
    config.shippingOptions.fulfillmentHandlers.push(myparcelHandler);
    return config;
  },
})
export class MyparcelPlugin {
  static loggerCtx = 'MyParcelPlugin'
  static apiKeys: MyParcelApiKeys;

  static init(apiKeys: MyParcelApiKeys): typeof MyparcelPlugin {
    this.apiKeys = apiKeys;
    return MyparcelPlugin;
  }
}

/**
 * ChannelToken: ApiKey
 */
export interface MyParcelApiKeys {
  [key: string]: string;
}
