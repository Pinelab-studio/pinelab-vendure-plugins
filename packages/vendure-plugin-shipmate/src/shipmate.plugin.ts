import {
  Order,
  PluginCommonModule,
  RequestContext,
  VendurePlugin,
} from '@vendure/core';
import { ShipmateService } from './api/shipmate.service';
import { HttpModule } from '@nestjs/axios';
import { ShipmateConfigEntity } from './api/shipmate-config.entity';
import { ShipmateConfigService } from './api/shipmate-config.service';
import {
  ShipmateAdminResolver,
  adminSchema,
  shipmatePermission,
} from './api/shipmate.admin.graphql';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { ShipmateController } from './api/shipmate.controller';
import { ShipmateWebhookTokenEntity } from './api/shipmate-webhook-token.entitiy';

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
  entities: [ShipmateConfigEntity, ShipmateWebhookTokenEntity],
  configuration: (config) => {
    config.authOptions.customPermissions.push(shipmatePermission);
    return config;
  },
  adminApiExtensions: {
    schema: adminSchema,
    resolvers: [ShipmateAdminResolver],
  },
  compatibility: '>=2.2.0',
})
export class ShipmatePlugin {
  static config: ShipmatePluginConfig;
  static init(config: ShipmatePluginConfig): typeof ShipmatePlugin {
    this.config = config;
    return ShipmatePlugin;
  }
  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    routes: [{ filePath: 'routes.ts', route: 'shipmate-config' }],
    providers: ['providers.ts'],
  };
}
