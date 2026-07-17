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
import { OrderExportPlugin } from '../src/order-export.plugin';
import { DefaultExportStrategy } from '../src/api/export-strategy';

require('dotenv').config();

export const config: VendureConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Debug }),
  apiOptions: {
    adminApiPlayground: true,
    shopApiPlayground: true,
  },
  dbConnectionOptions: {
    autoSave: false,
  },
  paymentOptions: {
    paymentMethodHandlers: [testPaymentMethod],
  },
  plugins: [
    OrderExportPlugin.init({
      exportStrategies: [new DefaultExportStrategy()],
    }),
    DefaultSearchPlugin,
    DashboardPlugin.init({
      route: 'dashboard',
      appDir: path.join(__dirname, '../dist/dashboard'),
    }),
  ],
});
// Override cors after merge, because testConfig sets cors: true (boolean)
// which mergeConfig can't properly replace with an object
config.apiOptions.cors = {
  origin: true,
  credentials: true,
};
