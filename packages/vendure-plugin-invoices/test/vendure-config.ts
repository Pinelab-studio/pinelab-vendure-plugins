import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  mergeConfig,
  DefaultLogger,
  LogLevel,
  DefaultSearchPlugin,
  VendureConfig,
} from '@vendure/core';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { InvoicePlugin, LocalFileStrategy } from '../src';
import { testConfig } from '@vendure/testing';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import path from 'path';

export const config: VendureConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Debug }),
  apiOptions: {
    adminApiPlayground: {},
    shopApiPlayground: {},
  },
  authOptions: {
    tokenMethod: ['bearer', 'cookie'],
  },
  dbConnectionOptions: {
    autoSave: false,
  },
  paymentOptions: {
    paymentMethodHandlers: [testPaymentMethod],
  },
  plugins: [
    InvoicePlugin.init({
      vendureHost: 'http://localhost:3050',
      storageStrategy: new LocalFileStrategy(),
    }),
    DefaultSearchPlugin,
    AdminUiPlugin.init({
      port: 3002,
      route: 'admin',
    }),
    DashboardPlugin.init({
      route: 'dashboard',
      appDir: path.join(__dirname, '../dist/dashboard'),
    }),
  ],
});
