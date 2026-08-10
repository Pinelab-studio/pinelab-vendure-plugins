require('dotenv').config();

import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  Order,
  RequestContext,
  VendureConfig,
} from '@vendure/core';
import { testConfig } from '@vendure/testing';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import path from 'path';
import { ShipmatePlugin } from '../src/shipmate.plugin';
import { testPaymentMethod } from '../../test/src/test-payment-method';

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
      shouldSendOrder: function (
        ctx: RequestContext,
        order: Order
      ): Promise<boolean> | boolean {
        return true;
      },
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
