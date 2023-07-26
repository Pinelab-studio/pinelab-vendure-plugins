import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { MyparcelConfigEntity } from './api/myparcel-config.entity';
import {
  MyparcelAdminResolver,
  adminSchema,
  myparcelPermission,
} from './api/myparcel.admin.graphql';
import { MyparcelController } from './api/myparcel.controller';
import { myparcelHandler } from './api/myparcel.handler';
import { MyparcelService } from './api/myparcel.service';
import { MyParcelShopResolver, shopSchema } from './api/myparcel.shop.graphql';
import { MyparcelConfig } from './api/types';
import { PLUGIN_INIT_OPTIONS } from './constants';

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
