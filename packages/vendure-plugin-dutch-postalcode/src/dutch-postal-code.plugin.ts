import {
  PluginCommonModule,
  VendurePlugin,
} from '@vendure/core';
import { PostalCodeResolver } from './postal-code.resolver';

@VendurePlugin({
  imports: [PluginCommonModule],
  shopApiExtensions: {
    schema: PostalCodeResolver.schema,
    resolvers: [PostalCodeResolver],
  },
})
export class DutchPostalCodePlugin {

  static apiKey: string;

  static init(apiKey: string): typeof DutchPostalCodePlugin {
    this.apiKey = apiKey;
    return DutchPostalCodePlugin;
  }

}
