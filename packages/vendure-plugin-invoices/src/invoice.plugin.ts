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
import path from 'path';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';

export interface InvoicePluginConfig {
  /**
   * Hostname to use for download links, can be the Vendure instance,
   * but also the worker instance if you want
   */
  downloadHost: string;
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

  static init(
    config: Partial<InvoicePluginConfig> & { downloadHost: string }
  ): typeof InvoicePlugin {
    this.config = {
      ...config,
      storageStrategy: config.storageStrategy || new DefaultStorageStrategy(),
      dataStrategy: config.dataStrategy || new DefaultDataStrategy(),
    };
    return InvoicePlugin;
  }

  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    ngModules: [
      {
        type: 'lazy',
        route: 'invoices',
        ngModuleFileName: 'invoices.module.ts',
        ngModuleName: 'InvoicesModule',
      },
      {
        type: 'shared',
        ngModuleFileName: 'invoices-nav.module.ts',
        ngModuleName: 'InvoicesNavModule',
      },
    ],
  };
}
