import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import {
  CustomerGroupExtensionsResolver,
  shopSchema,
} from './api/api-extensions';
import { CustomerGroupExtensionsService } from './service/customer-group-extensions.service';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { customFields } from './config/custom-fields';

export interface ExampleOptions {
  enabled: boolean;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [CustomerGroupExtensionsService],
  shopApiExtensions: {
    resolvers: [CustomerGroupExtensionsResolver],
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
