import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { AnonymizeOrderShopResolver } from './anonymized-order.resolver';
import { AnonymizeOrderService } from './anonymized-order.service';
import { anonymizeOrderShopSchema } from './api-extensions';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { AnonymizeOrderPluginOptions } from './types';

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
  compatibility: '>=2.2.0',
})
export class AnonymizedOrderPlugin {
  static options: AnonymizeOrderPluginOptions | undefined;

  static init(
    options: AnonymizeOrderPluginOptions,
  ): typeof AnonymizedOrderPlugin {
    AnonymizedOrderPlugin.options = options;
    return AnonymizedOrderPlugin;
  }
}
