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
import path from 'path';
import { StripeSubscriptionPlugin } from '../src/';
import { StripeTestCheckoutPlugin } from './helpers/stripe-test-checkout.plugin';

export const config: VendureConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Debug }),
  authOptions: {
    cookieOptions: {
      secret: '123',
    },
    tokenMethod: ['cookie', 'bearer'],
  },
  apiOptions: {
    adminApiPlayground: {},
    shopApiPlayground: {},
  },
  plugins: [
    StripeTestCheckoutPlugin,
    StripeSubscriptionPlugin.init({
      vendureHost: process.env.VENDURE_HOST!,
      // subscriptionStrategy: new DownPaymentSubscriptionStrategy(),
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
});
