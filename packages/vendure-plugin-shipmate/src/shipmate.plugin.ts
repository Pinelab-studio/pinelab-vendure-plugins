import {
  Order,
  PluginCommonModule,
  RequestContext,
  RuntimeVendureConfig,
  VendurePlugin,
} from '@vendure/core';
import { ShipmateService } from './api/shipmate.service';
import { HttpModule } from '@nestjs/axios';
import { ShipmateConfigService } from './api/shipmate-config.service';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { ShipmateController } from './api/shipmate.controller';
import { channelCustomFields, shipmatePermission } from './custom-fields';

export interface ShipmatePluginConfig {
  apiUrl:
    | 'https://api.shipmate.co.uk/v1.2'
    | 'https://api-staging.shipmate.co.uk/v1.2';
  shouldSendOrder(
    ctx: RequestContext,
    order: Order
  ): Promise<boolean> | boolean;
}

@VendurePlugin({
  imports: [PluginCommonModule, HttpModule],
  controllers: [ShipmateController],
  providers: [
    ShipmateService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => ShipmatePlugin.config,
    },
    ShipmateConfigService,
  ],
  configuration: (config: RuntimeVendureConfig) => {
    config.authOptions.customPermissions.push(shipmatePermission);
    config.customFields.Channel.push(...channelCustomFields);
    return config;
  },
  compatibility: '>=2.2.0',
})
export class ShipmatePlugin {
  static config: ShipmatePluginConfig;
  static init(config: ShipmatePluginConfig): typeof ShipmatePlugin {
    this.config = config;
    return ShipmatePlugin;
  }
}
