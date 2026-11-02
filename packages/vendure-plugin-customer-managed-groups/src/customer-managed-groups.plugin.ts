import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { adminSchema } from './api/admin-graphql';
import { customFields } from './api/custom-fields';
import {
  CustomerManagedGroupsAdminResolver,
  CustomerManagedGroupsShopResolver,
} from './api/customer-managed-groups.resolver';
import { CustomerManagedGroupsService } from './api/customer-managed-groups.service';
import { shopSchema } from './api/shop-graphql';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [CustomerManagedGroupsService],
  adminApiExtensions: {
    resolvers: [CustomerManagedGroupsAdminResolver],
    schema: adminSchema,
  },
  shopApiExtensions: {
    resolvers: [CustomerManagedGroupsShopResolver],
    schema: shopSchema,
  },
  configuration: (config) => {
    config.customFields = {
      ...config.customFields,
      ...customFields,
    };
    return config;
  },
  compatibility: '>=2.2.0',
})
export class CustomerManagedGroupsPlugin {}
