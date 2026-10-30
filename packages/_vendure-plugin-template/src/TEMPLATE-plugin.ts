import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { TEMPLATEPluginOptions } from './types';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => TEMPLATEPlugin.options,
    },
  ],
  configuration: (config) => {
    return config;
  },
  compatibility: '>=3.2.0',
})
export class TEMPLATEPlugin {
  // FIXME

  static options: TEMPLATEPluginOptions = {
    // FIXME
    sampleOption: true,
  };

  static init(options: TEMPLATEPluginOptions): Type<TEMPLATEPlugin> {
    // FIXME
    TEMPLATEPlugin.options = {
      ...TEMPLATEPlugin.options,
      ...options,
    };
    return TEMPLATEPlugin;
  }
}
