import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

import { ADDRESS_LOOKUP_PLUGIN_OPTIONS } from './constants';
import { PluginInitOptions } from './types';
import { AddressLookupService } from './services/address-lookup.service';
import { AddressLookupResolver } from './api/address-lookup.resolver';
import { shopApiExtensions } from './api/api-extensions';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: ADDRESS_LOOKUP_PLUGIN_OPTIONS,
      useFactory: () => AddressLookupPlugin.options,
    },
    AddressLookupService,
  ],
  configuration: (config) => {
    return config;
  },
  compatibility: '>=2.2.0',
  shopApiExtensions: {
    schema: shopApiExtensions,
    resolvers: [AddressLookupResolver],
  },
})
export class AddressLookupPlugin {
  static options: PluginInitOptions;

  static init(options: PluginInitOptions): Type<AddressLookupPlugin> {
    this.options = options;
    return AddressLookupPlugin;
  }
}
