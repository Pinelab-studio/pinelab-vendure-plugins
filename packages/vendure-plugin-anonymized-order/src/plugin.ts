import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { AnonymizeOrderPluginOptions } from './types';
import { AnonymizeOrderService } from './anonymized-order.service';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { AnonymizeOrderShopResolver } from './anonymized-order.resolver';
import { anonymizeOrderShopSchema } from './api-extensions';

@VendurePlugin({
  providers: [
    AnonymizeOrderService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => AnonymizedOrderPlugin.options,
    },
  ],
  shopApiExtensions: {
    resolvers: [AnonymizeOrderShopResolver],
    schema: anonymizeOrderShopSchema,
  },
  imports: [PluginCommonModule],
})
export class AnonymizedOrderPlugin {
  static options: AnonymizeOrderPluginOptions | undefined;

  static init(
    options: AnonymizeOrderPluginOptions
  ): typeof AnonymizedOrderPlugin {
    this.options = options;
    return AnonymizedOrderPlugin;
  }
}
