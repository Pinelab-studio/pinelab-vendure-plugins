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
import { StoreCreditPlugin, storeCreditPaymentHandler } from '../src';

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
    autoSave: false,
  },
  paymentOptions: {
    paymentMethodHandlers: [storeCreditPaymentHandler, testPaymentMethod],
  },
  plugins: [
    StoreCreditPlugin.init({
      createGiftCardWallet: async () => ({
        price: 1000,
        cardCode: `GIFT-DEMO-${Date.now()}`,
      }),
    }),
    DefaultSearchPlugin,
    DashboardPlugin.init({
      // The route should correspond to the `base` setting
      // in the vite.config.mts file
      route: 'dashboard',
      // This appDir should correspond to the `build.outDir`
      // setting in the vite.config.mts file
      // appDir: './dist/dashboard',
      appDir: path.join(__dirname, '../dist/dashboard'),
    }),
  ],
});
