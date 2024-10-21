import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

import { CAMPAIGN_TRACKER_PLUGIN_OPTIONS } from './constants';
import { PluginInitOptions } from './types';
import { CampaignTrackerService } from './services/campaign-tracker.service';
import { CampaignTrackerAdminResolver } from './api/campaign-tracker-admin.resolver';
import { adminApiExtensions } from './api/api-extensions';
import { Campaign } from './entities/campaign.entity';
import { OrderCampaign } from './entities/order-campaign.entity';

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
    return config;
  },
  compatibility: '>=3.0.0',
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [CampaignTrackerAdminResolver],
  },
  entities: [Campaign, OrderCampaign],
})
export class CampaignTrackerPlugin {
  static options: PluginInitOptions;

  static init(options: PluginInitOptions): Type<CampaignTrackerPlugin> {
    this.options = options;
    return CampaignTrackerPlugin;
  }
}
