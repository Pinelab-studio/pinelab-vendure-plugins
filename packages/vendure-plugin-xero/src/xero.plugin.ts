import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

import { VENDURE_PLUGIN_XERO_PLUGIN_OPTIONS } from './constants';
import { XeroService } from './services/xero.service';
import { XeroAdminResolver } from './api/xero-admin.resolver';
import { adminApiExtensions } from './api/api-extensions';

export interface XeroPluginOptions {}

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: VENDURE_PLUGIN_XERO_PLUGIN_OPTIONS,
      useFactory: () => XeroPlugin.options,
    },
    XeroService,
  ],
  configuration: (config) => {
    return config;
  },
  compatibility: '>=2.2.0',
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [XeroAdminResolver],
  },
})
export class XeroPlugin {
  static options: XeroPluginOptions;

  static init(options: XeroPluginOptions): Type<XeroPlugin> {
    this.options = options;
    return XeroPlugin;
  }
}
