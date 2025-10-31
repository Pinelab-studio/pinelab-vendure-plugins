import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';

import { adminApiExtensions, shopApiExtensions } from './api/api-extensions';
import { UTM_TRACKER_PLUGIN_OPTIONS } from './constants';
import { UtmOrderParameter } from './entities/utm-order-parameter.entity';
import { UTMTrackerService } from './services/utm-tracker.service';
import { UTMTrackerPluginInitOptions } from './types';
import { UTMTrackerShopResolver } from './api/utm-tracker.shop-resolver';
import { FirstClickAttribution } from './config/first-click-attribution';
import { UTMTrackerAdminResolver } from './api/utm-tracker.admin-resolver';
import path from 'path';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: UTM_TRACKER_PLUGIN_OPTIONS,
      useFactory: () => UTMTrackerPlugin.options,
    },
    UTMTrackerService,
  ],
  compatibility: '^3.0.0',
  entities: [UtmOrderParameter],
  shopApiExtensions: {
    schema: shopApiExtensions,
    resolvers: [UTMTrackerShopResolver],
  },
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [UTMTrackerAdminResolver],
  },
})
export class UTMTrackerPlugin {
  static options: UTMTrackerPluginInitOptions = {
    attributionModel: new FirstClickAttribution(),
    maxParametersPerOrder: 5,
    maxAttributionAgeInDays: 30,
  };

  static init(
    options: Partial<UTMTrackerPluginInitOptions>
  ): Type<UTMTrackerPlugin> {
    this.options = {
      ...this.options,
      ...options,
    };
    return UTMTrackerPlugin;
  }

  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    providers: ['providers.ts'],
  };
}
