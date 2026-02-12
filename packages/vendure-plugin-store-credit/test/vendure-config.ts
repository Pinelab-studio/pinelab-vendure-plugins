import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  mergeConfig,
  DefaultLogger,
  LogLevel,
  DefaultSearchPlugin,
  VendureConfig,
} from '@vendure/core';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { testConfig } from '@vendure/testing';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import path from 'path';
import { storeCreditPaymentHandler, StoreCreditPlugin } from '../src';

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
  },
  paymentOptions: {
    paymentMethodHandlers: [storeCreditPaymentHandler, testPaymentMethod],
  },
  plugins: [
    StoreCreditPlugin,
    DefaultSearchPlugin,
    AdminUiPlugin.init({
      port: 3002,
      route: 'admin',
    }),
    DashboardPlugin.init({
      // The route should correspond to the `base` setting
      // in the vite.config.mts file
      route: 'dashboard',
      // This appDir should correspond to the `build.outDir`
      // setting in the vite.config.mts file
      // appDir: './dist/dashboard',
      appDir: path.join(__dirname, './dist/dashboard'),
    }),
  ],
});
