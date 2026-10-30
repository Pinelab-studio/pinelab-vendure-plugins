require('dotenv').config();

import path from 'node:path';
import {
  AutoIncrementIdStrategy,
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  VendureConfig,
} from '@vendure/core';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { testConfig } from '@vendure/testing';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { LimitedProductsPlugin } from '../src';

export const config: VendureConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Debug }),
  apiOptions: {
    shopApiPlayground: true,
    adminApiPlayground: true,
  },
  authOptions: {
    tokenMethod: ['cookie', 'bearer'],
  },
  paymentOptions: {
    paymentMethodHandlers: [testPaymentMethod],
  },
  entityOptions: {
    entityIdStrategy: new AutoIncrementIdStrategy(),
  },
  plugins: [
    LimitedProductsPlugin,
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
