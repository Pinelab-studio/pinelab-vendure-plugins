import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { ChangeOrderCustomerResolver } from './api/change-order-customer.resolver';
import { adminApiExtensions } from './api/api-extensions';
import { ChangeOrderCustomerService } from './api/change-order-customer.service';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [ChangeOrderCustomerService],
  adminApiExtensions: {
    resolvers: [ChangeOrderCustomerResolver],
    schema: adminApiExtensions,
  },
})
export class ChangeOrderCustomerPlugin {
  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    providers: ['providers.ts'],
  };
}
