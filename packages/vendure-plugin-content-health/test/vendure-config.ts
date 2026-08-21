require('dotenv').config();

import {
  Administrator,
  DefaultLogger,
  DefaultSchedulerPlugin,
  DefaultSearchPlugin,
  dummyPaymentHandler,
  LogLevel,
  mergeConfig,
  TransactionalConnection,
  VendureConfig,
} from '@vendure/core';
import { testConfig } from '@vendure/testing';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import path from 'path';
import { ContentHealthPlugin } from '../src';
import { MOCK_STOREFRONT_PORT } from './mock-storefront-server';

export const config: VendureConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Debug }),
  apiOptions: {
    adminApiPlayground: true,
    shopApiPlayground: true,
  },
  authOptions: {
    tokenMethod: ['cookie', 'bearer'],
  },
  paymentOptions: {
    paymentMethodHandlers: [dummyPaymentHandler],
  },
  plugins: [
    ContentHealthPlugin.init({
      getProductUrl: (ctx, { product, languageCode }) =>
        `http://localhost:${MOCK_STOREFRONT_PORT}/${languageCode}/products/${product.slug}`,
      getCollectionUrl: (ctx, { collection, languageCode }) =>
        `http://localhost:${MOCK_STOREFRONT_PORT}/${languageCode}/collections/${collection.slug}`,
      getSitemapUrl: () =>
        `http://localhost:${MOCK_STOREFRONT_PORT}/sitemap.xml`,
      maxRedirects: 5,
      shouldCheckEntity: (ctx, entity) =>
        'enabled' in entity ? entity.enabled : !entity.isPrivate,
      checks: {
        product: [
          (ctx, { product }) => {
            const description = (product.description ?? '') as string;
            if (description.trim().length < 20) {
              return [
                {
                  source: 'demo-description-check',
                  severity: 'warning',
                  code: 'PRODUCT_DESCRIPTION_TOO_SHORT',
                  message:
                    'Product description should be at least 20 characters long.',
                },
              ];
            }
            return [];
          },
        ],
      },
      additionalChecks: [
        async (ctx, injector) => {
          const connection = injector.get(TransactionalConnection);
          const administrators = await connection
            .getRepository(ctx, Administrator)
            .find();
          return administrators
            .filter((admin) => !admin.emailAddress?.includes('@'))
            .map((admin) => ({
              entityType: 'administrator',
              entityId: admin.id,
              label:
                `${admin.firstName} ${admin.lastName}`.trim() ||
                admin.emailAddress,
              url: `/administrators/${admin.id}`,
              messages: [
                {
                  source: 'demo-admin-email-check',
                  severity: 'warning' as const,
                  code: 'ADMINISTRATOR_EMAIL_INVALID',
                  message: "Administrator email address doesn't look valid.",
                },
              ],
            }));
        },
      ],
    }),
    DefaultSearchPlugin,
    DefaultSchedulerPlugin.init(),
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
