require('dotenv').config();

import path from 'node:path';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  VendureConfig,
} from '@vendure/core';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { testConfig } from '@vendure/testing';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { UShapedAttribution } from '../src';
import { UTMTrackerPlugin } from '../src/utm-tracker.plugin';

export const config: VendureConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Debug }),
  apiOptions: {
    adminApiPlayground: {},
    shopApiPlayground: {},
  },
  authOptions: {
    tokenMethod: ['cookie', 'bearer'],
  },
  dbConnectionOptions: {
    autoSave: true,
    synchronize: true,
  },
  paymentOptions: {
    paymentMethodHandlers: [testPaymentMethod],
  },
  plugins: [
    DefaultSearchPlugin,
    UTMTrackerPlugin.init({
      attributionModel: new UShapedAttribution(),
      maxParametersPerOrder: 5,
      maxAttributionAgeInDays: 30,
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
