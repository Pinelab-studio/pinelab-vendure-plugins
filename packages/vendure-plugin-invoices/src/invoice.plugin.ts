import { OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  Injector,
  Logger,
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
import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';
import { InvoiceConfigEntity } from './entities/invoice-config.entity';
import { InvoiceEntity } from './entities/invoice.entity';
import { AccountingService } from './services/accounting.service';
import { InvoiceService } from './services/invoice.service';
import { AccountingExportStrategy } from './strategies/accounting/accounting-export-strategy';
import { defaultLoadDataFn, LoadDataFn } from './strategies/load-data-fn';
import { LocalFileStrategy } from './strategies/storage/local-file-strategy';
import { StorageStrategy } from './strategies/storage/storage-strategy';

export interface InvoicePluginConfigInput {
  /**
   * @description
   * Hostname to use for download links, can be the main or worker instance.
   * Make sure to include protocol and no trailing slash, e.g. https://vendure.myshop.com
   */
  vendureHost: string;
  /**
   * @description
   * Load custom data that is passed in to your HTML/handlebars template
   */
  loadDataFn?: LoadDataFn;
  storageStrategy?: StorageStrategy;
  /**
   * Start counting invoices from this number onwards
   */
  startInvoiceNumber?: number;
  /**
   * You can supply accounting export strategies per channel, which will export the invoices to your accounting software.
   */
  accountingExports?: AccountingExportStrategy[];
}

export interface InvoicePluginConfig extends InvoicePluginConfigInput {
  loadDataFn: LoadDataFn;
  storageStrategy: StorageStrategy;
  startInvoiceNumber: number;
}

/**
 * @description
 * Vendure plugin to generate PDF invoices for orders.
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [InvoiceConfigEntity, InvoiceEntity],
  providers: [
    InvoiceService,
    { provide: PLUGIN_INIT_OPTIONS, useFactory: () => InvoicePlugin.config },
    AccountingService,
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
  compatibility: '>=3.2.0',
  configuration: (config: RuntimeVendureConfig) => {
    config.authOptions.customPermissions.push(invoicePermission);
    return config;
  },
})
export class InvoicePlugin implements OnModuleInit {
  static config: InvoicePluginConfig;

  constructor(private moduleRef: ModuleRef) {}

  async onModuleInit(): Promise<void> {
    // Initialize accounting export strategies, if they define an init function
    for (const strategy of InvoicePlugin.config.accountingExports || []) {
      if (strategy.init) {
        await strategy.init(new Injector(this.moduleRef));
        Logger.info(
          `Initialized accounting export strategy: ${strategy.constructor.name}`,
          loggerCtx
        );
      }
    }
    // Initialize storage strategy
    if (InvoicePlugin.config.storageStrategy) {
      await InvoicePlugin.config.storageStrategy.init();
      Logger.info(
        `Initialized storage strategy: ${InvoicePlugin.config.storageStrategy.constructor.name}`,
        loggerCtx
      );
    }
  }

  static init(config: InvoicePluginConfigInput): Type<InvoicePlugin> {
    InvoicePlugin.config = {
      ...config,
      storageStrategy: config.storageStrategy || new LocalFileStrategy(),
      loadDataFn: config.loadDataFn || defaultLoadDataFn,
      startInvoiceNumber: config.startInvoiceNumber || 10000,
    };
    return this;
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
