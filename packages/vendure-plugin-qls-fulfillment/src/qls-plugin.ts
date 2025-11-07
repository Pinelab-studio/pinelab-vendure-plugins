import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { QlsPluginOptions } from './types';
import { QlsService } from './services/qls.service';
import { QlsAdminResolver } from './api/qls-admin.resolver';
import { adminApiExtensions } from './api/api-extensions';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => QlsPlugin.options,
    },
    QlsService,
  ],
  configuration: (config) => {
    return config;
  },
  compatibility: '>=3.2.0',
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [QlsAdminResolver],
  },
})
export class QlsPlugin {
  static options: QlsPluginOptions;

  static init(options: QlsPluginOptions): Type<QlsPlugin> {
    this.options = options;
    return QlsPlugin;
  }
}
