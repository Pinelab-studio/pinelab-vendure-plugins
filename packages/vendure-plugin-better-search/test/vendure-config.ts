import {
  DefaultLogger,
  LogLevel,
  mergeConfig,
  VendureConfig,
} from '@vendure/core';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import { testConfig } from '@vendure/testing';
import path from 'path';
import { BetterSearchPlugin, MinisearchEngine } from '../src';
import { DashboardPlugin } from '@vendure/dashboard/plugin';

export const config: VendureConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Debug }),
  dbConnectionOptions: {
    autosave: true,
  } as any,
  authOptions: {
    tokenMethod: ['bearer', 'cookie'],
  },
  apiOptions: {
    adminApiPlayground: {},
    shopApiPlayground: {},
  },
  importExportOptions: {
    importAssetsDir: path.join(__dirname),
  },
  plugins: [
    BetterSearchPlugin.init({
      searchEngine: new MinisearchEngine({
        boost: { productName: 2, slug: 1.5, description: 1 },
        prefix: true,
        fuzzy: 0.2,
      }),
    }),
    AssetServerPlugin.init({
      route: 'assets',
      assetUploadDir: path.join(__dirname, '__data__/assets'),
      assetUrlPrefix: 'http://localhost:3050/assets/',
    }),
    DashboardPlugin.init({
      route: 'dashboard',
      appDir: path.join(__dirname, '../dist/dashboard'),
    }),
  ],
});
