require('dotenv').config();

import path from 'node:path';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  Order,
  RequestContext,
  VendureConfig,
} from '@vendure/core';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { testConfig } from '@vendure/testing';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { ShipmatePlugin } from '../src/shipmate.plugin';

export const config: VendureConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Debug }),
  apiOptions: {
    shopApiPlayground: true,
    adminApiPlayground: true,
  },
  authOptions: {
    tokenMethod: ['bearer', 'cookie'],
  },
  plugins: [
    ShipmatePlugin.init({
      apiUrl: process.env.SHIPMATE_BASE_URL as any,
      shouldSendOrder: (
        _ctx: RequestContext,
        _order: Order,
      ): Promise<boolean> | boolean => true,
    }),
    DefaultSearchPlugin,
    DashboardPlugin.init({
      // The route should correspond to the `base` setting
      // in the vite.config.mts file
      route: 'dashboard',
      // This appDir should correspond to the `build.outDir`
      // setting in the vite.config.mts file
      appDir: path.join(__dirname, '../dist/dashboard'),
    }),
  ],
  paymentOptions: {
    paymentMethodHandlers: [testPaymentMethod],
  },
});
