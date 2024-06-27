import {
  PluginCommonModule,
  RuntimeVendureConfig,
  Type,
  VendurePlugin,
} from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import {
  adminSchemaExtensions,
  shopSchemaExtensions,
} from './api/api-extensions';
import { InvoiceAdminResolver } from './api/invoice-admin.resolver';
import {
  InvoiceCommonResolver,
  invoicePermission,
} from './api/invoice-common.resolver';
import { InvoiceController } from './api/invoice.controller';
import { defaultLoadDataFn, LoadDataFn } from './strategies/load-data-fn';
import { LocalFileStrategy } from './strategies/local-file-strategy';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { InvoiceConfigEntity } from './entities/invoice-config.entity';
import { InvoiceEntity } from './entities/invoice.entity';
import { StorageStrategy } from './strategies/storage-strategy';
import { InvoiceService } from './services/invoice.service';

export interface InvoicePluginConfig {
  /**
   * Hostname to use for download links, can be the Vendure instance,
   * but also the worker instance if you want.
   * Make sure to include protocol and no trailing slash, e.g. https://vendure.myshop.com
   */
  vendureHost: string;
  /**
   * Load custom data that is passed in to your HTML/handlebars template
   */
  loadDataFn: LoadDataFn;
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
    schema: adminSchemaExtensions,
    resolvers: [InvoiceAdminResolver, InvoiceCommonResolver],
  },
  shopApiExtensions: {
    schema: shopSchemaExtensions,
    resolvers: [InvoiceCommonResolver],
  },
  compatibility: '^2.0.0',
  configuration: (config: RuntimeVendureConfig) => {
    InvoicePlugin.configure(config);
    return config;
  },
})
export class InvoicePlugin {
  static config: InvoicePluginConfig;

  static init(
    config: Partial<InvoicePluginConfig> & { vendureHost: string }
  ): Type<InvoicePlugin> {
    InvoicePlugin.config = {
      vendureHost: config.vendureHost,
      storageStrategy: config.storageStrategy || new LocalFileStrategy(),
      loadDataFn: config.loadDataFn || defaultLoadDataFn,
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
    routes: [{ filePath: 'routes.ts', route: 'invoice-list' }],
    providers: ['providers.ts'],
  };
}
