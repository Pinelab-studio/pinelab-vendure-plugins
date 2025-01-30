import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

import { DROP_OFF_POINTS_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { PluginInitOptions } from './types';
import { DropOffPointsService } from './services/drop-off-points.service';
import { DropOffPointsAdminResolver } from './api/drop-off-points-admin.resolver';
import { adminApiExtensions } from './api/api-extensions';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: DROP_OFF_POINTS_PLUGIN_OPTIONS,
      useFactory: () => DropOffPointsPlugin.options,
    },
    DropOffPointsService,
  ],
  configuration: (config) => {
    // Plugin-specific configuration
    // such as custom fields, custom permissions,
    // strategies etc. can be configured here by
    // modifying the `config` object.
    return config;
  },
  compatibility: '=>2.2.0',
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [DropOffPointsAdminResolver],
  },
})
export class DropOffPointsPlugin {
  static options: PluginInitOptions;

  static init(options: PluginInitOptions): Type<DropOffPointsPlugin> {
    // Check if there are providers with the same carrierName
    const carrierNames = options.carriers.map((p) => p.name);
    const duplicateCarrierNames = carrierNames.filter(
      (name, index) => carrierNames.indexOf(name) !== index
    );
    if (duplicateCarrierNames.length) {
      throw new Error(
        `[${loggerCtx}] Carrier name should be unique, but found: ${duplicateCarrierNames.join(
          ','
        )}`
      );
    }
    this.options = options;
    return DropOffPointsPlugin;
  }
}
