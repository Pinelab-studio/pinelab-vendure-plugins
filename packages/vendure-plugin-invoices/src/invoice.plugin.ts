import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { invoicePermission } from './index';
import { schema } from './api/schema.graphql';
import { InvoiceService } from './api/invoice.service';

@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [],
  providers: [InvoiceService],
  controllers: [],
  adminApiExtensions: {
    schema,
    resolvers: [],
  },
  configuration: (config) => {
    config.authOptions.customPermissions.push(invoicePermission);
    return config;
  },
})
export class InvoicePlugin {
  static init(): typeof InvoicePlugin {
    return InvoicePlugin;
  }
}
