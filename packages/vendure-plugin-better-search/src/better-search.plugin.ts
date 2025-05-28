import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

import { shopApiExtensions } from './api/api-extensions';
import { SearchShopResolver } from './api/search.resolver';
import { BETTER_SEARCH_PLUGIN_OPTIONS } from './constants';
import { SearchService } from './services/search.service';
import { PluginInitOptions } from './types';
import { IndexService } from './services/index.service';
import { defaultSearchConfig } from './default-config';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: BETTER_SEARCH_PLUGIN_OPTIONS,
      useFactory: () => BetterSearchPlugin.options,
    },
    SearchService,
    IndexService,
  ],
  configuration: (config) => {
    return config;
  },
  compatibility: '^3.0.0',
  shopApiExtensions: {
    schema: shopApiExtensions,
    resolvers: [SearchShopResolver],
  },
})
export class BetterSearchPlugin {
  static options: PluginInitOptions = defaultSearchConfig;

  static init(options: PluginInitOptions): Type<BetterSearchPlugin> {
    this.options = options;
    return BetterSearchPlugin;
  }
}
