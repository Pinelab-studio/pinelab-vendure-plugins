import {
  DefaultLogger,
  LogLevel,
  mergeConfig,
  VendureConfig,
} from '@vendure/core';
import { testConfig } from '@vendure/testing';
import path from 'path';
import { BetterSearchPlugin } from '../src';
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
  plugins: [
    BetterSearchPlugin.init({}),
    DashboardPlugin.init({
      route: 'dashboard',
      appDir: path.join(__dirname, '../dist/dashboard'),
    }),
  ],
});
