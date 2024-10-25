import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';

import { adminApiExtensions, shopApiExtensions } from './api/api-extensions';
import { CampaignTrackerAdminResolver } from './api/campaign-tracker-admin.resolver';
import { CampaignTrackerShopResolver } from './api/campaign-tracker-shop.resolver';
import { CAMPAIGN_TRACKER_PLUGIN_OPTIONS } from './constants';
import { Campaign } from './entities/campaign.entity';
import { OrderCampaign } from './entities/order-campaign.entity';
import { LastInteractionAttribution } from './services/attribution-models';
import { CampaignTrackerService } from './services/campaign-tracker.service';
import { CampaignTrackerOptions } from './types';
import path from 'path';

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
  shopApiExtensions: {
    schema: shopApiExtensions,
    resolvers: [CampaignTrackerShopResolver],
  },
  entities: [Campaign, OrderCampaign],
})
export class CampaignTrackerPlugin {
  static options: CampaignTrackerOptions = {
    attributionModel: new LastInteractionAttribution(),
  };

  static init(
    options: Partial<CampaignTrackerOptions>
  ): Type<CampaignTrackerPlugin> {
    this.options = {
      ...this.options,
      ...options,
    };
    return CampaignTrackerPlugin;
  }

  static ui: AdminUiExtension = {
    id: 'campaign-tracker',
    extensionPath: path.join(__dirname, 'ui'),
    routes: [{ route: 'campaigns', filePath: 'routes.ts' }],
    providers: ['providers.ts'],
  };
}
