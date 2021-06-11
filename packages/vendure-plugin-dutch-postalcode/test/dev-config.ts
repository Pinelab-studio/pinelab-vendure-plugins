import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import { testConfig } from '@vendure/testing';
import { DutchPostalCodePlugin } from '../src/dutch-postal-code.plugin';

export const devConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Debug }),
  plugins: [DutchPostalCodePlugin.init(process.env.APIKEY as string)],
});
