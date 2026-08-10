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
import { GoogleSheetLoaderPlugin } from '../src';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { TestDataStrategy } from './test-data-strategy';

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
  dbConnectionOptions: {
    autoSave: true,
  },
  plugins: [
    GoogleSheetLoaderPlugin.init({
      strategies: [new TestDataStrategy()],
      googleApiKey: process.env.GOOGLE_SHEET_API_KEY!,
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
