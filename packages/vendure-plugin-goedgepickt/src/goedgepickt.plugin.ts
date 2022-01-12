import { PluginCommonModule, RuntimeVendureConfig, VendurePlugin } from "@vendure/core";
import { GoedgepicktService } from './goedgepickt.service';
import { GoedgepicktController } from "./goedgepickt.controller";
import { goedgepicktHandler } from "./goedgepickt.handler";
import { GoedgepicktPluginConfig } from "./goedgepickt.types";

export const GgLoggerContext = 'GoedgepicktPlugin';

@VendurePlugin({
  imports: [PluginCommonModule],
  controllers: [GoedgepicktController],
  providers: [GoedgepicktService],
    configuration: (config: RuntimeVendureConfig) => {
      config.shippingOptions.fulfillmentHandlers.push(goedgepicktHandler);
      return config;
    }
})
export class GoedgepicktPlugin {
  static config: GoedgepicktPluginConfig;

  static init(config: GoedgepicktPluginConfig): typeof GoedgepicktPlugin {
    this.config = config;
    return GoedgepicktPlugin;
  }
}
