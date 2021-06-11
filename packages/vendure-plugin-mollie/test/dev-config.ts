import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import { testConfig } from '@vendure/testing';
import { MolliePlugin } from '../src';

require('dotenv').config();
export const devConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Debug }),
  plugins: [MolliePlugin],
});
