import {
  Asset,
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
    autoSave: false,
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
                },
              ],
            },
            {
              name: 'image',
              type: 'relation',
              entity: Asset,
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
