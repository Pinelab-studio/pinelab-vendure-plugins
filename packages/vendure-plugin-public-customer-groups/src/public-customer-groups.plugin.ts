import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { PublicCustomerGroupsResolver } from './public-customer-groups.resolver';
import { shopApiExtensions } from './schema';

@VendurePlugin({
  imports: [PluginCommonModule],
  configuration: (config) => {
    config.customFields.CustomerGroup.push({
      name: 'isPublic',
      type: 'boolean',
      public: false,
    });
    return config;
  },
  shopApiExtensions: {
    resolvers: [PublicCustomerGroupsResolver],
    schema: shopApiExtensions,
  },
  compatibility: '>=2.2.0',
})
export class PublicCustomerGroupsPlugin {}
