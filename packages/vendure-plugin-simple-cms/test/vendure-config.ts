import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  VendureConfig,
} from '@vendure/core';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { testConfig } from '@vendure/testing';
import path from 'path';
import { LanguageCode } from '@vendure/core';
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
      contentTypes: [
        {
          code: 'featured_product',
          displayName: [
            { languageCode: LanguageCode.en, value: 'Featured Product' },
          ],
          allowMultiple: false,
          fields: [
            {
              name: 'title',
              type: 'localeString',
              label: [{ languageCode: LanguageCode.en, value: 'Title' }],
            },
            {
              name: 'image',
              type: 'relation',
            },
          ],
        },
      ],
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
