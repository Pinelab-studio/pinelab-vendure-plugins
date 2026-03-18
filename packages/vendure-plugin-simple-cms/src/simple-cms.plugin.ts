import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { ContentEntry } from './entities/content-entry.entity';
import { ContentEntryService } from './services/content-entry.service';
import {
  adminSchemaExtensions,
  shopSchemaExtensions,
} from './api/api-extensions';
import { CommonResolver } from './api/common.resolver';
import { AdminResolver } from './api/admin.resolver';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { SimpleCmsPluginOptions } from './types';

@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [ContentEntry],
  providers: [
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => SimpleCmsPlugin.options,
    },
    ContentEntryService,
  ],
  shopApiExtensions: {
    schema: shopSchemaExtensions,
    resolvers: [CommonResolver],
  },
  adminApiExtensions: {
    schema: adminSchemaExtensions,
    resolvers: [CommonResolver, AdminResolver],
  },
  compatibility: '>=3.2.0',
  dashboard: './dashboard/index.tsx',
})
export class SimpleCmsPlugin {
  static options: SimpleCmsPluginOptions = {
    contentTypes: [],
  };

  static init(options: SimpleCmsPluginOptions): Type<SimpleCmsPlugin> {
    this.options = {
      ...this.options,
      ...options,
    };
    return SimpleCmsPlugin;
  }
}
