import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { shopSchema } from './api/shop-graphql';
import { adminSchema } from './api/admin-graphql';
import { customFields } from './api/custom-fields';
import { CustomerManagedGroupsService } from './api/customer-managed-groups.service';
import {
  CustomerManagedGroupsAdminResolver,
  CustomerManagedGroupsShopResolver,
} from './api/customer-managed-groups.resolver';

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
export class CustomerManagedGroupsPlugin {
  // static ui: AdminUiExtension = {
  //   extensionPath: path.join(__dirname, 'ui'),
  //   ngModules: [
  //     {
  //       type: 'shared',
  //       ngModuleFileName: 'customer-group-extension.shared-module.ts',
  //       ngModuleName: 'CustomerGroupExtensionSharedModule',
  //     },
  //   ],
  // };
}
