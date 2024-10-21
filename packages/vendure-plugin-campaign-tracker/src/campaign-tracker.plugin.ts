import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

import { CAMPAIGN_TRACKER_PLUGIN_OPTIONS } from './constants';
import { PluginInitOptions } from './types';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: CAMPAIGN_TRACKER_PLUGIN_OPTIONS,
      useFactory: () => CampaignTrackerPlugin.options,
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
export class CampaignTrackerPlugin {
  static options: PluginInitOptions;

  static init(options: PluginInitOptions): Type<CampaignTrackerPlugin> {
    this.options = options;
    return CampaignTrackerPlugin;
  }
}
