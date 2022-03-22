import {
  PluginCommonModule,
  RuntimeVendureConfig,
  VendurePlugin,
} from '@vendure/core';
import path from 'path';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';

@VendurePlugin({
  imports: [PluginCommonModule],
  controllers: [],
  configuration: (config: RuntimeVendureConfig) => {
    // config.paymentOptions.paymentMethodHandlers.push();
    return config;
  },
})
export class BitpayPlugin {}
