import {
  Logger,
  PluginCommonModule,
  RuntimeVendureConfig,
  Type,
  VendurePlugin,
} from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { InvoiceConfigEntity } from './api/entities/invoice-config.entity';
import { InvoiceEntity } from './api/entities/invoice.entity';
import { InvoiceController } from './api/invoice.controller';
import { InvoiceResolver } from './api/invoice.resolver';
import { InvoiceService } from './api/invoice.service';
import { schema } from './api/schema.graphql';
import { DataStrategy } from './api/strategies/data-strategy';
import { DefaultDataStrategy } from './api/strategies/default-data-strategy';
import { LocalFileStrategy } from './api/strategies/local-file-strategy';
import { loggerCtx, PLUGIN_INIT_OPTIONS, PLUGIN_NAME } from './constants';
import { StorageStrategy } from './index';
import { invoicePermission } from './api/invoice.resolver';

export interface InvoicePluginConfig {
  /**
   * @deprecated We are moving this paid plugin to the Vendure Marketplace soon, so a licensekey won't be needed anymore.
   * Existing customers will be migrated to the new system ofcourse.
   */
  licenseKey?: string;
  /**
   * Hostname to use for download links, can be the Vendure instance,
   * but also the worker instance if you want
   */
  vendureHost: string;
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
    schema: schema as any,
    resolvers: [InvoiceResolver],
  },
  compatibility: '^2.0.0',
  configuration: (config: RuntimeVendureConfig) =>
    InvoicePlugin.configure(config),
})
export class InvoicePlugin {
  static config: InvoicePluginConfig;

  static init(
    config: Partial<InvoicePluginConfig> & { vendureHost: string }
  ): Type<InvoicePlugin> {
    InvoicePlugin.config = {
      ...config,
      storageStrategy: config.storageStrategy || new LocalFileStrategy(),
      dataStrategy: config.dataStrategy || new DefaultDataStrategy(),
    };
    return this;
  }

  static async configure(
    config: RuntimeVendureConfig
  ): Promise<RuntimeVendureConfig> {
    config.authOptions.customPermissions.push(invoicePermission);
    if (this.config.storageStrategy) {
      await this.config.storageStrategy.init();
    }
    return config;
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
