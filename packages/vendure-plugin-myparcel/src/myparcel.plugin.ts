import { PluginCommonModule, RuntimeVendureConfig, VendurePlugin } from "@vendure/core";
import { myparcelHandler } from "./api/myparcel.handler";
import { MyparcelService } from "./api/myparcel.service";
import { MyparcelController } from "./api/myparcel.controller";
import path from "path";
import { AdminUiExtension } from "@vendure/ui-devkit/compiler";
import { MyparcelConfigEntity } from "./api/myparcel-config.entity";

@VendurePlugin({
  imports: [PluginCommonModule],
  controllers: [MyparcelController],
  entities: [MyparcelConfigEntity],
  providers: [MyparcelService],
  configuration: (config: RuntimeVendureConfig) => {
    config.shippingOptions.fulfillmentHandlers.push(myparcelHandler);
    return config;
  }
})
export class MyparcelPlugin {
  static loggerCtx = "MyParcelPlugin";
  static webhookHost: string;

  static init(config: { vendureHost: string }): typeof MyparcelPlugin {
    this.webhookHost = config.vendureHost;
    return MyparcelPlugin;
  }

  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, "ui"),
    ngModules: [
      {
        type: "lazy",
        route: "webhook",
        ngModuleFileName: "webhook.module.ts",
        ngModuleName: "WebhookModule"
      },
      {
        type: "shared",
        ngModuleFileName: "webhook-nav.module.ts",
        ngModuleName: "WebhookNavModule"
      }
    ]
  };
}

/**
 * ChannelToken: ApiKey
 */
export interface MyParcelApiKeys {
  [key: string]: string;
}
