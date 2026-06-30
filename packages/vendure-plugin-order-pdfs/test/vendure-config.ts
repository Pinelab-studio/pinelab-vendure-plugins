import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  VendureConfig,
} from '@vendure/core';
import { testConfig } from '@vendure/testing';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { OrderPDFsPlugin } from '../src';
import path from 'path';

require('dotenv').config();

export const config: VendureConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Debug }),
  plugins: [
    OrderPDFsPlugin.init({
      allowPublicDownload: true,
    }),
    DefaultSearchPlugin,
    AdminUiPlugin.init({
      port: 3002,
      route: 'admin',
      app: compileUiExtensions({
        outputPath: path.join(__dirname, '__admin-ui'),
        extensions: [OrderPDFsPlugin.ui],
        devMode: true,
      }),
    }),
  ],
  paymentOptions: {
    paymentMethodHandlers: [testPaymentMethod],
  },
  apiOptions: {
    adminApiPlayground: true,
    cors: {
      origin: true,
      credentials: true,
    },
  },
});
