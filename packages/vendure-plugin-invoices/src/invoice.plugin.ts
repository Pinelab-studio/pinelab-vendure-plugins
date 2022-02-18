import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import {
  DefaultStorageStrategy,
  invoicePermission,
  StorageStrategy,
} from './index';
import { schema } from './api/schema.graphql';
import { InvoiceService } from './api/invoice.service';
import {
  DataStrategy,
  DefaultDataStrategy,
} from './api/strategies/data-strategy';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { InvoiceConfigEntity } from './api/entities/invoice-config.entity';
import { InvoiceResolver } from './api/invoice.resolver';
import { InvoiceEntity } from './api/entities/invoice.entity';
import { InvoiceController } from './api/invoice.controller';

export interface InvoicePluginConfig {
  dataStrategy: DataStrategy;
  storageStrategy: StorageStrategy;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [InvoiceConfigEntity, InvoiceEntity],
  providers: [
    InvoiceService,
    { provide: PLUGIN_INIT_OPTIONS, useFactory: () => InvoicePlugin.config },
  ],
  controllers: [InvoiceController],
  adminApiExtensions: {
    schema,
    resolvers: [InvoiceResolver],
  },
  configuration: (config) => {
    config.authOptions.customPermissions.push(invoicePermission);
    return config;
  },
})
export class InvoicePlugin {
  static config: InvoicePluginConfig;

  static init(config: Partial<InvoicePluginConfig>): typeof InvoicePlugin {
    this.config = {
      ...config,
      storageStrategy: config.storageStrategy || new DefaultStorageStrategy(),
      dataStrategy: config.dataStrategy || new DefaultDataStrategy(),
    };
    return InvoicePlugin;
  }
}
