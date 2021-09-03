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
export class SimpleCmsPlugin {
  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    ngModules: [
      /*      {
        type: 'lazy',
        route: 'simple-cms',
        ngModuleFileName: 'simple-cms,module.ts',
        ngModuleName: 'SimpleCmsModule',
      },*/
      {
        type: 'shared',
        ngModuleFileName: 'simple-cms-nav.module.ts',
        ngModuleName: 'SimpleCmsNavModule',
      },
    ],
  };
}
