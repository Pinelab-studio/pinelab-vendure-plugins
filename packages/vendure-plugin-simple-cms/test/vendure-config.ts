import {
  Product,
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  VendureConfig,
} from '@vendure/core';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { testConfig } from '@vendure/testing';
import path from 'path';
import { SimpleCmsPlugin } from '../src';

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
    autoSave: true,
  },
  plugins: [
    SimpleCmsPlugin.init({
      contentTypes: {
        featuredProduct: {
          displayName: 'Featured Product',
          allowMultiple: false,
          fields: [
            {
              name: 'subtitle',
              type: 'string',
              nullable: true,
              isTranslatable: false,
            },
            {
              name: 'title',
              type: 'string',
              isTranslatable: true,
            },
            {
              name: 'seo',
              type: 'struct',
              isTranslatable: true,
              fields: [
                {
                  name: 'metaTitle',
                  type: 'string',
                  isTranslatable: false,
                },
                {
                  name: 'metaDescription',
                  type: 'text',
                  isTranslatable: false,
                  ui: { component: 'textarea-form-input' },
                },
              ],
            },
            {
              name: 'product',
              type: 'relation',
              entity: Product,
              graphQLType: 'Product',
              nullable: false,
              ui: { component: 'product-selector-form-input' },
            },
          ],
        },
        banner: {
          displayName: 'Banner',
          allowMultiple: true,
          fields: [
            {
              name: 'title',
              type: 'string',
              isTranslatable: true,
            },
            {
              name: 'priority',
              type: 'int',
              isTranslatable: false,
              nullable: true,
            },
            {
              name: 'product',
              type: 'relation',
              entity: Product,
              graphQLType: 'Product',
              nullable: false,
            },
          ],
        },
      },
    }),
    DefaultSearchPlugin,
    DashboardPlugin.init({
      route: 'dashboard',
      appDir: path.join(__dirname, '../dist/dashboard'),
    }),
  ],
});
