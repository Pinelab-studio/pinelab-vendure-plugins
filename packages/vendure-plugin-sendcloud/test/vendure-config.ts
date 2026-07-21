require('dotenv').config();

import {
  configureDefaultOrderProcess,
  DefaultLogger,
  DefaultSchedulerPlugin,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  VendureConfig,
} from '@vendure/core';
import { testConfig } from '@vendure/testing';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import path from 'path';
import {
  fulfillSettledOrdersTask,
  getCouponCodes,
  getNrOfOrders,
  ParcelInputItem,
  SendcloudPlugin,
} from '../src';
import { testPaymentMethod } from '../../test/src/test-payment-method';

export const config: VendureConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Debug }),
  apiOptions: {
    adminApiPlayground: true,
    shopApiPlayground: true,
  },
  authOptions: {
    tokenMethod: ['cookie', 'bearer'],
  },
  plugins: [
    SendcloudPlugin.init({
      additionalParcelItemsFn: async (ctx, injector, order) => {
        const additionalInputs: ParcelInputItem[] = [];
        additionalInputs.push(await getNrOfOrders(ctx, injector, order));
        const coupons = getCouponCodes(order);
        if (coupons) {
          additionalInputs.push(coupons);
        }
        return additionalInputs;
      },
    }),
    DefaultSchedulerPlugin,
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
  paymentOptions: {
    paymentMethodHandlers: [testPaymentMethod],
  },
  schedulerOptions: {
    runTasksInWorkerOnly: false,
    tasks: [fulfillSettledOrdersTask],
  },
  orderOptions: {
    process: [
      configureDefaultOrderProcess({ checkFulfillmentStates: false }) as any,
    ],
  },
});
