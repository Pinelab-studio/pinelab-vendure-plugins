import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

import { shopApiExtensions } from './api/api-extensions';
import { SearchShopResolver } from './api/search.resolver';
import { BETTER_SEARCH_PLUGIN_OPTIONS } from './constants';
import { defaultSearchConfig } from './default-config';
import { BetterSearchDocuments } from './entities/better-search-documents.entity';
import { IndexService } from './services/index.service';
import { SearchService } from './services/search.service';
import { BetterSearchConfig, BetterSearchConfigInput } from './types';

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
  entities: [BetterSearchDocuments],
})
export class BetterSearchPlugin {
  static options: BetterSearchConfig = defaultSearchConfig;

  static init(options: BetterSearchConfigInput): Type<BetterSearchPlugin> {
    BetterSearchPlugin.options = { ...BetterSearchPlugin.options, ...options };
    return BetterSearchPlugin;
  }
}
