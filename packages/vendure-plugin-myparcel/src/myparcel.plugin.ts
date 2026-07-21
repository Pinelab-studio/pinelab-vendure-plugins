import {
  PluginCommonModule,
  RuntimeVendureConfig,
  VendurePlugin,
} from '@vendure/core';
import { MyparcelController } from './api/myparcel.controller';
import { myparcelHandler } from './api/myparcel.handler';
import { MyparcelService } from './api/myparcel.service';
import { MyParcelShopResolver, shopSchema } from './api/myparcel.shop.graphql';
import { MyparcelConfig, PartialBy } from './api/types';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { MyParcalDefaultShipmentStrategy } from './api/myparcel-default-shipment.strategy';
import { channelCustomFields, myparcelPermission } from './custom-fields';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    MyparcelService,
    { provide: PLUGIN_INIT_OPTIONS, useFactory: () => MyparcelPlugin.config },
  ],
  controllers: [MyparcelController],
  shopApiExtensions: {
    schema: shopSchema,
    resolvers: [MyParcelShopResolver],
  },
  configuration: (config: RuntimeVendureConfig) => {
    config.shippingOptions.fulfillmentHandlers.push(myparcelHandler);
    config.authOptions.customPermissions.push(myparcelPermission);
    config.customFields.Channel.push(...channelCustomFields);
    return config;
  },
  compatibility: '>=2.2.0',
})
export class MyparcelPlugin {
  static config: MyparcelConfig;

  static init(
    config: PartialBy<MyparcelConfig, 'shipmentStrategy'>
  ): typeof MyparcelPlugin {
    this.config = {
      ...config,
      shipmentStrategy:
        config.shipmentStrategy ?? new MyParcalDefaultShipmentStrategy(),
    };
    return MyparcelPlugin;
  }
}
