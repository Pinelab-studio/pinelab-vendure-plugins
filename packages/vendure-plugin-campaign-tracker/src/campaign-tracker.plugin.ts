import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

import { CAMPAIGN_TRACKER_PLUGIN_OPTIONS } from './constants';
import { PluginInitOptions } from './types';
import { CampaignTrackerService } from './services/campaign-tracker.service';
import { CampaignTrackerAdminResolver } from './api/campaign-tracker-admin.resolver';
import { adminApiExtensions } from './api/api-extensions';
import { Campaign } from './entities/campaign.entity';
import { OrderCampaign } from './entities/order-campaign.entity';
import { OrderCampaignTranslation } from './entities/order-campaign-translation.entity';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: CAMPAIGN_TRACKER_PLUGIN_OPTIONS,
      useFactory: () => CampaignTrackerPlugin.options,
    },
    CampaignTrackerService,
  ],
  configuration: (config) => {
    // Plugin-specific configuration
    // such as custom fields, custom permissions,
    // strategies etc. can be configured here by
    // modifying the `config` object.
    return config;
  },
  compatibility: '^3.0.0',
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [CampaignTrackerAdminResolver],
  },
  entities: [Campaign, OrderCampaign, OrderCampaignTranslation],
})
export class CampaignTrackerPlugin {
  static options: PluginInitOptions;

  static init(options: PluginInitOptions): Type<CampaignTrackerPlugin> {
    this.options = options;
    return CampaignTrackerPlugin;
  }
}
