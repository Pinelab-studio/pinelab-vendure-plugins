import path from 'node:path';
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
import { defaultMetrics, MetricsPlugin } from '../src';
import { VariantPricesMetric } from './variant-prices.metric';

export const config: VendureConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Info }),
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
    DefaultSchedulerPlugin.init(),
    MetricsPlugin.init({
      metrics: [...defaultMetrics, new VariantPricesMetric()],
    }),
    DefaultSearchPlugin,
    DashboardPlugin.init({
      // Should correspond to `base` and `build.outDir` in vite.config.mts
      route: 'dashboard',
      appDir: path.join(__dirname, '../dist/dashboard'),
    }),
  ],
});
