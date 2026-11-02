import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

import { shopApiExtensions } from './api/api-extensions';
import { ValidateCartResolver } from './api/validate-cart.resolver';
import { VALIDATE_CART_PLUGIN_OPTIONS } from './constants';
import { ValidateCartService } from './services/validate-cart.service';
import { DefaultStockValidationStrategy } from './services/validate-cart-strategy';
import { ValidateCartInitOptions } from './types';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: VALIDATE_CART_PLUGIN_OPTIONS,
      useFactory: () => ValidateCartPlugin.options,
    },
    ValidateCartService,
  ],
  configuration: (config) => {
    return config;
  },
  compatibility: '^3.0.0',
  shopApiExtensions: {
    schema: shopApiExtensions,
    resolvers: [ValidateCartResolver],
  },
})
export class ValidateCartPlugin {
  static options: ValidateCartInitOptions = {
    validationStrategy: new DefaultStockValidationStrategy(),
    logWarningAfterMs: 1000,
  };

  static init(options: ValidateCartInitOptions): Type<ValidateCartPlugin> {
    ValidateCartPlugin.options = {
      ...ValidateCartPlugin.options,
      ...options,
    };
    return ValidateCartPlugin;
  }
}
