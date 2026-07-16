require('dotenv').config();

import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  VendureConfig,
} from '@vendure/core';
import { testConfig } from '@vendure/testing';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import path from 'path';
import { GoedgepicktPlugin } from '../src';
import { testPaymentMethod } from '../../test/src/test-payment-method';

export const config: VendureConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Debug }),
  apiOptions: {
    adminApiPlayground: {},
    shopApiPlayground: {},
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
      endpointSecret: 'test',
      setWebhook: true,
      determineOrderStatus: async (ctx, order) => 'on_hold' as const,
    }),
    DefaultSearchPlugin,
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
