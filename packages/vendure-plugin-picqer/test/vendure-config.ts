require('dotenv').config();

import {
  configureDefaultOrderProcess,
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  OrderProcess,
  VendureConfig,
} from '@vendure/core';
import { testConfig } from '@vendure/testing';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import path from 'path';
import { PicqerPlugin } from '../src';
import { testPaymentMethod } from '../../test/src/test-payment-method';

export const config: VendureConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Debug }),
  apiOptions: {
    adminApiPlayground: {},
    shopApiPlayground: {},
  },
  authOptions: {
    tokenMethod: ['cookie', 'bearer'],
  },
  orderOptions: {
    process: [
      configureDefaultOrderProcess({
        checkFulfillmentStates: false,
      }) as OrderProcess<any>,
    ],
  },
  paymentOptions: {
    paymentMethodHandlers: [testPaymentMethod],
  },
  customFields: {
    // Sample custom field to test the custom fields config behavior
    ProductVariant: [
      {
        name: 'noLongerAvailable',
        type: 'string',
      },
    ],
  },
  plugins: [
    PicqerPlugin.init({
      enabled: true,
      vendureHost: process.env.HOST!,
      // These are just test values to test the strtegies, they don't mean anything in this context
      pushProductVariantFields: (variant) => ({ barcode: variant.sku }),
      pullPicqerProductFields: (picqerProd) => ({ outOfStockThreshold: 123 }),
      pushPicqerOrderFields: (order) => ({
        customer_remarks: 'test note',
        pickup_point_data: {
          carrier: 'dhl',
          id: '901892834',
        },
      }),
      pushPicqerOrderLineFields: (ctx, orderLine, order) => ({
        remarks: `Test note on line '${orderLine.id}' for order '${order.code}`,
      }),
      shouldSyncOnProductVariantCustomFields: ['noLongerAvailable'],
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
