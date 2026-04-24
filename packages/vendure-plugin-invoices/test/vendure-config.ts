import {
  mergeConfig,
  DefaultLogger,
  LogLevel,
  DefaultSearchPlugin,
  VendureConfig,
} from '@vendure/core';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { InvoicePlugin, LocalFileStrategy, XeroUKExportStrategy } from '../src';
import { testConfig } from '@vendure/testing';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import path from 'path';

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
    InvoicePlugin.init({
      vendureHost: 'http://localhost:3050',
      storageStrategy: new LocalFileStrategy(),
      startInvoiceNumber: Math.floor(100000 + Math.random() * 900000),
      accountingExports: [
        new XeroUKExportStrategy({
          clientId: process.env.XERO_CLIENT_ID!,
          clientSecret: process.env.XERO_CLIENT_SECRET!,
          shippingAccountCode: '0103',
          salesAccountCode: '0102',
          invoiceBrandingThemeId: '62f2bce1-32c4-4e8d-a9b1-87060fb7c791',
          getReference: () =>
            'THIS IS A TEST INVOICE, DONT APPROVE THIS PLEASE.',
          getVendureUrl: (order) =>
            `https://pinelab.studio/order/${order.code}`,
          getDueDate: (ctx, order, invoice) => {
            const payment = order.payments.find((p) => p.state === 'Settled');
            if (payment?.method === 'purchase-order') {
              const date = new Date();
              date.setDate(date.getDate() + 30);
              return date;
            } else {
              return new Date();
            }
          },
        }),
      ],
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
