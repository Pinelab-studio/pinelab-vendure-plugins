import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

import { BETTER_SEARCH_PLUGIN_OPTIONS } from './constants';
import { PluginInitOptions } from './types';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: BETTER_SEARCH_PLUGIN_OPTIONS,
      useFactory: () => BetterSearchPlugin.options,
    },
  ],
  configuration: (config) => {
    return config;
  },
  compatibility: '^3.0.0',
})
export class BetterSearchPlugin {
  static options: PluginInitOptions;

  static init(options: PluginInitOptions): Type<BetterSearchPlugin> {
    this.options = options;
    return BetterSearchPlugin;
  }
}
