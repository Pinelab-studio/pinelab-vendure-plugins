import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

import { DROP_OFF_POINTS_PLUGIN_OPTIONS } from './constants';
import { PluginInitOptions } from './types';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: DROP_OFF_POINTS_PLUGIN_OPTIONS,
      useFactory: () => DropOffPointsPlugin.options,
    },
  ],
  configuration: (config) => {
    // Plugin-specific configuration
    // such as custom fields, custom permissions,
    // strategies etc. can be configured here by
    // modifying the `config` object.
    return config;
  },
  compatibility: '^3.0.0',
})
export class DropOffPointsPlugin {
  static options: PluginInitOptions;

  static init(options: PluginInitOptions): Type<DropOffPointsPlugin> {
    this.options = options;
    return DropOffPointsPlugin;
  }
}
