require('dotenv').config();

import path from 'node:path';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import {
  DefaultLogger,
  DefaultSchedulerPlugin,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  VendureConfig,
} from '@vendure/core';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { testConfig } from '@vendure/testing';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { GoedgepicktPlugin } from '../src';

export const config: VendureConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Debug }),
  apiOptions: {
    adminApiPlayground: {},
    shopApiPlayground: {},
  },
  schedulerOptions: {
    runTasksInWorkerOnly: false,
  },
  authOptions: {
    tokenMethod: ['cookie', 'bearer'],
  },
  paymentOptions: {
    paymentMethodHandlers: [testPaymentMethod],
  },
  plugins: [
    GoedgepicktPlugin.init({
      vendureHost: process.env.WEBHOOK_ENDPOINT!,
      setWebhook: true,
      determineOrderStatus: async (_ctx, _order) => 'on_hold' as const,
    }),
    DefaultSearchPlugin,
    DefaultSchedulerPlugin.init({}),
    AssetServerPlugin.init({
      assetUploadDir: path.join(__dirname, '__data__/assets'),
      route: 'assets',
    }),
    DashboardPlugin.init({
      // The route should correspond to the `base` setting
      // in the vite.config.mts file
      route: 'dashboard',
      // This appDir should correspond to the `build.outDir`
      // setting in the vite.config.mts file
      appDir: path.join(__dirname, '../dist/dashboard'),
    }),
  ],
});
