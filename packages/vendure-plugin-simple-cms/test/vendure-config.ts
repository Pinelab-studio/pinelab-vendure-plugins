import {
  Product,
  ProductVariant,
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  VendureConfig,
  Asset,
} from '@vendure/core';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { testConfig } from '@vendure/testing';
import path from 'path';
import { SimpleCmsPlugin } from '../src';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';

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
              name: 'title',
              type: 'string',
              isTranslatable: true,
            },
            {
              name: 'subtitle',
              type: 'string',
              nullable: true,
              isTranslatable: false,
            },
            {
              name: 'seo',
              type: 'struct',
              isTranslatable: true,
              fields: [
                {
                  name: 'metaTitle',
                  type: 'string',
                },
                {
                  name: 'metaDescription',
                  type: 'text',
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
            },
          ],
        },
        banner: {
          displayName: 'Banner',
          allowMultiple: true,
          fields: [
            {
              name: 'title',
              type: 'text',
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
            {
              name: 'relatedProducts',
              type: 'relation',
              entity: Product,
              graphQLType: 'Product',
              list: true,
              nullable: true,
              ui: {
                component: 'product-multi-form-input',
                selectionMode: 'product',
              },
            },
            {
              name: 'variant',
              type: 'relation',
              entity: ProductVariant,
              graphQLType: 'ProductVariant',
              nullable: true,
            },
            {
              name: 'relatedVariants',
              type: 'relation',
              entity: ProductVariant,
              graphQLType: 'ProductVariant',
              list: true,
              nullable: true,
              ui: {
                component: 'product-multi-form-input',
                selectionMode: 'variant',
              },
            },
          ],
        },
        metric: {
          displayName: 'Metric',
          allowMultiple: true,
          fields: [
            {
              name: 'name',
              type: 'string',
              isTranslatable: true,
            },
            {
              name: 'description',
              type: 'text',
              isTranslatable: true,
              ui: { component: 'rich-text-form-input' },
            },
            {
              name: 'value',
              type: 'int',
              isTranslatable: false,
              nullable: false,
            },
            {
              name: 'asset',
              type: 'relation',
              entity: Asset,
              graphQLType: 'Asset',
              nullable: false,
              // ui: { component: ''}
            },
          ],
        },
      },
    }),
    DefaultSearchPlugin,
    AssetServerPlugin.init({
      route: 'assets',
      assetUploadDir: path.join(__dirname, '../__data__/assets'),
    }),
    DashboardPlugin.init({
      route: 'dashboard',
      appDir: path.join(__dirname, '../dist/dashboard'),
    }),
  ],
});
