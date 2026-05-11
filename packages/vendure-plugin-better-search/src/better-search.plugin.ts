import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { adminApiExtensions } from './api/api-extensions';
import { SearchAdminResolver } from './api/search-admin.resolver';
import { SearchShopResolver } from './api/search.resolver';
import { BETTER_SEARCH_PLUGIN_OPTIONS } from './constants';
import { SearchService } from './services/search.service';
import { BetterSearchOptions } from './types';
import { IndexService } from './services/index.service';
import { BetterSearchIndex } from './entities/better-search-index.entity';

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
    resolvers: [SearchShopResolver],
  },
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [SearchAdminResolver],
  },
  entities: [BetterSearchIndex],
})
export class BetterSearchPlugin {
  static options: BetterSearchOptions;

  static init(options: BetterSearchOptions): Type<BetterSearchPlugin> {
    this.options = options;
    return BetterSearchPlugin;
  }
}
