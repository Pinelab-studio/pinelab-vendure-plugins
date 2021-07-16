import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import { testConfig } from '@vendure/testing';
import { alwaysSettleHandler } from '../../test/test-vendure-utils';
import { SendcloudPlugin } from '../src';

require('dotenv').config();
export const devConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Debug }),
  paymentOptions: {
    paymentMethodHandlers: [alwaysSettleHandler],
  },
  plugins: [
    SendcloudPlugin.init({
      publicKey: process.env.SENDCLOUD_API_PUBLIC!,
      secret: process.env.SENDCLOUD_API_SECRET!,
    }),
  ],
  customFields: {
    Product: [{ name: 'weight', type: 'int', defaultValue: 300 }],
  },
});
