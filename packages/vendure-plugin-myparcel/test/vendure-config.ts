import {
  DefaultLogger,
  DefaultSearchPlugin,
  LanguageCode,
  LogLevel,
  mergeConfig,
  VendureConfig,
} from '@vendure/core';
import { testConfig } from '@vendure/testing';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import path from 'path';
import { MyparcelPlugin } from '../src/myparcel.plugin';
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
  customFields: {
    Product: [
      {
        name: 'weight',
        label: [{ value: 'Weight', languageCode: LanguageCode.en }],
        type: 'int',
        ui: { component: 'text-form-input' },
      },
    ],
  },
  plugins: [
    MyparcelPlugin.init({
      // Placeholder host, overridden in dev-server.ts once the localtunnel is up.
      // Vite only imports this file for schema introspection, so this value is never used for real requests.
      vendureHost: 'http://localhost:3050',
      getCustomsInformationFn: (orderLine) => {
        return {
          weightInGrams:
            (orderLine.productVariant.product.customFields as any)?.weight ||
            0,
          classification:
            (orderLine.productVariant.product.customFields as any)?.hsCode ||
            '0181',
          countryCodeOfOrigin: 'NL',
        };
      },
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
  paymentOptions: {
    paymentMethodHandlers: [testPaymentMethod],
  },
});
