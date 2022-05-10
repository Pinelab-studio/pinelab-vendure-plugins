import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { myparcelHandler } from './api/myparcel.handler';
import { MyparcelController } from './api/myparcel.controller';
import path from 'path';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import { MyparcelConfigEntity } from './api/myparcel-config.entity';
import { MyparcelService } from './api/myparcel.service';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { myparcelPermission } from './index';
import {
  adminSchema,
  MyparcelAdminResolver,
} from './api/myparcel.admin.graphql';
import { MyParcelShopResolver, shopSchema } from './api/myparcel.shop.graphql';

export interface MyparcelConfig {
  vendureHost: string;
  /**
   * Update webhook in MyParcel platform on Vendure startup or not
   */
  syncWebhookOnStartup?: boolean;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [MyparcelConfigEntity],
  providers: [
    MyparcelService,
    { provide: PLUGIN_INIT_OPTIONS, useFactory: () => MyparcelPlugin.config },
  ],
  controllers: [MyparcelController],
  adminApiExtensions: {
    schema: adminSchema,
    resolvers: [MyparcelAdminResolver],
  },
  shopApiExtensions: {
    schema: shopSchema,
    resolvers: [MyParcelShopResolver],
  },
  configuration: (config) => {
    config.shippingOptions.fulfillmentHandlers.push(myparcelHandler);
    config.authOptions.customPermissions.push(myparcelPermission);
    return config;
  },
})
export class MyparcelPlugin {
  static config: MyparcelConfig;

  static init(config: MyparcelConfig): typeof MyparcelPlugin {
    this.config = config;
    return MyparcelPlugin;
  }

  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    ngModules: [
      {
        type: 'lazy',
        route: 'myparcel',
        ngModuleFileName: 'myparcel.module.ts',
        ngModuleName: 'MyparcelModule',
      },
      {
        type: 'shared',
        ngModuleFileName: 'myparcel-nav.module.ts',
        ngModuleName: 'MyparcelNavModule',
      },
    ],
  };
}

/**
 * ChannelToken: ApiKey
 */
export interface MyParcelApiKeys {
  [key: string]: string;
}
