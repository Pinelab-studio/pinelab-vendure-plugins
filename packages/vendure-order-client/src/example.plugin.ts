import { PluginCommonModule, VendurePlugin } from '@vendure/core';

export interface ExampleOptions {
  enabled: boolean;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [],
  shopApiExtensions: {},
})
export class ExamplePlugin {
  static options: ExampleOptions;

  static init(options: ExampleOptions) {
    this.options = options;
    return ExamplePlugin;
  }
}
