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
import path from 'path';
import { QlsPlugin } from '../src';
import { testPaymentMethod } from '../../test/src/test-payment-method';

/**
 * Vendure configuration used by the dashboard Vite dev server.
 */
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
    paymentMethodHandlers: [testPaymentMethod],
  },
  plugins: [
    QlsPlugin.init({
      getConfig: () => ({
        username: 'dashboard-dev',
        password: 'dashboard-dev',
        companyId: 'dashboard-dev',
        brandId: 'dashboard-dev',
      }),
      webhookSecret: 'dashboard-dev-secret',
      orderSync: {
        autoPushOrders: false,
      },
      productSync: {
        getAdditionalVariantFields: () => ({
          ean: '0000000000000',
          image_url: 'https://example.com/image.png',
        }),
        qlsProductIdUiTab: 'QLS',
      },
    }),
    DefaultSearchPlugin,
    DefaultSchedulerPlugin,
    DashboardPlugin.init({
      route: 'dashboard',
      appDir: path.join(__dirname, '../dist/dashboard'),
    }),
  ],
});
