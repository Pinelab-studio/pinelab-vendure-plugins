require('dotenv').config();
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import { testConfig } from '@vendure/testing';
import { GoedgepicktPlugin } from '../src/goedgepickt.plugin';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';

export const localConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Debug }),
  apiOptions: {
    adminListQueryLimit: 10000,
  },
  plugins: [
    GoedgepicktPlugin.init({
      configPerChannel: [
        {
          channelToken: 'e2e-default-channel',
          apiKey: process.env.GOEDGEPICKT_APIKEY!,
          webshopUuid: process.env.GOEDGEPICKT_WEBSHOPUUID!,
          orderWebhookKey: process.env.GOEDGEPICKT_WEBHOOK_ORDERSTATUS_KEY!,
          stockWebhookKey: process.env.GOEDGEPICKT_WEBHOOK_STOCK_UPDATE_KEY!,
        },
      ],
    }),
    DefaultSearchPlugin,
    AdminUiPlugin.init({
      port: 3002,
      route: 'admin',
    }),
  ],
});
