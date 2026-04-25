import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { ContentEntry } from './entities/content-entry.entity';
import { ContentEntryTranslation } from './entities/content-entry-translation.entity';
import { ContentEntryService } from './services/content-entry.service';
import { adminSchemaExtensions, shopApiExtensions } from './api/api-extensions';
import { CommonResolver } from './api/common.resolver';
import { AdminResolver } from './api/admin.resolver';
import {
  createShopResolver,
  ContentEntryInterfaceResolver,
} from './api/shop.resolver';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { SimpleCmsPluginOptions } from './types';

@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [ContentEntry, ContentEntryTranslation],
  providers: [
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => SimpleCmsPlugin.options,
    },
    ContentEntryService,
  ],
  shopApiExtensions: {
    schema: () => shopApiExtensions(SimpleCmsPlugin.options),
    resolvers: () => [
      SimpleCmsPlugin.getShopResolver(),
      ContentEntryInterfaceResolver,
    ],
  },
  adminApiExtensions: {
    schema: () => adminSchemaExtensions,
    resolvers: [CommonResolver, AdminResolver],
  },
  compatibility: '>=3.2.0',
  dashboard: './dashboard/index.tsx',
})
export class SimpleCmsPlugin {
  static options: SimpleCmsPluginOptions;
  private static shopResolver?: Type<unknown>;

  static init(options: SimpleCmsPluginOptions): Type<SimpleCmsPlugin> {
    this.options = {
      ...options,
    };
    return SimpleCmsPlugin;
  }

  /**
   * Lazily builds (and caches) the dynamic shop resolver class so that
   * the resolver is generated after `init()` has been called.
   */
  static getShopResolver(): Type<unknown> {
    if (!this.shopResolver) {
      this.shopResolver = createShopResolver(this.options);
    }
    return this.shopResolver;
  }
}
