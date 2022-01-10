require("dotenv").config();
import { DefaultLogger, DefaultSearchPlugin, LogLevel, mergeConfig } from "@vendure/core";
import { testConfig } from "@vendure/testing";
import { GoedgepicktPlugin } from "../src/goedgepickt.plugin";
import { AdminUiPlugin } from "@vendure/admin-ui-plugin";

export const localConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Debug }),
  apiOptions: {
    adminListQueryLimit: 10000
  },
  plugins: [
    GoedgepicktPlugin.init({
      vendureHost: process.env.VENDURE_HOST!,
      configPerChannel: [{
        channelToken: "e2e-default-channel",
        apiKey: process.env.GOEDGEPICKT_APIKEY!,
        webshopUuid: process.env.GOEDGEPICKT_WEBSHOPUUID!
      }]
    }),
    DefaultSearchPlugin,
    AdminUiPlugin.init({
      port: 3002,
      route: "admin"
    })
  ]
});