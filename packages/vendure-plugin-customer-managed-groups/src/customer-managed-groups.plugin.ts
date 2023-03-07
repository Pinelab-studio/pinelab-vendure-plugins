import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { CustomerManagedGroupsResolver, shopSchema } from './api-extensions';
import { CustomerManagedGroupsService } from './customer-managed-groups.service';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { customFields } from './custom-fields';

export interface ExampleOptions {
  enabled: boolean;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [CustomerManagedGroupsService],
  shopApiExtensions: {
    resolvers: [CustomerManagedGroupsResolver],
    schema: shopSchema,
  },
  configuration: (config) => {
    config.customFields = {
      ...config.customFields,
      ...customFields,
    };
    return config;
  },
})
export class CustomerManagedGroupsPlugin {
  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    ngModules: [
      {
        type: 'shared',
        ngModuleFileName: 'customer-group-extension.shared-module.ts',
        ngModuleName: 'CustomerGroupExtensionSharedModule',
      },
    ],
  };
}
