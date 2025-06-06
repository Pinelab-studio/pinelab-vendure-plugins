import {
  Injector,
  Logger,
  PluginCommonModule,
  RuntimeVendureConfig,
  Type,
  VendurePlugin,
} from '@vendure/core';
import { OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
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
import { LocalFileStrategy } from './strategies/storage/local-file-strategy';
import { PLUGIN_INIT_OPTIONS, loggerCtx } from './constants';
import { InvoiceConfigEntity } from './entities/invoice-config.entity';
import { InvoiceEntity } from './entities/invoice.entity';
import { StorageStrategy } from './strategies/storage/storage-strategy';
import { InvoiceService } from './services/invoice.service';
import {
  LicenseService,
  VendureHubPlugin,
} from '@vendure-hub/vendure-hub-plugin';
import { AccountingExportStrategy } from './strategies/accounting/accounting-export-strategy';
import { AccountingService } from './services/accounting.service';

export interface InvoicePluginConfigInput {
  /**
   * @description
   * Hostname to use for download links, can be the main or worker instance.
   * Make sure to include protocol and no trailing slash, e.g. https://vendure.myshop.com
   */
  vendureHost: string;
  /**
   * @description
   * License key obtained from the Vendure Hub
   */
  licenseKey: string;
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
  hasValidLicense: boolean;
  startInvoiceNumber: number;
}

/**
 * @description
 * Vendure plugin to generate PDF invoices for orders.
 */
@VendurePlugin({
  imports: [PluginCommonModule, VendureHubPlugin],
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
export class InvoicePlugin implements OnApplicationBootstrap, OnModuleInit {
  static config: InvoicePluginConfig;

  constructor(
    private licenseService: LicenseService,
    private moduleRef: ModuleRef
  ) {}

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

  onApplicationBootstrap(): void {
    this.licenseService
      .checkLicenseKey(
        InvoicePlugin.config.licenseKey,
        '@vendure-hub/pinelab-invoice-plugin'
      )
      .then((result) => {
        if (!result.valid) {
          Logger.error(
            `Your license key is invalid. Make sure to obtain a valid license key from the Vendure Hub if you want to keep using this plugin. Viewing invoices is disabled. Invoice generation will continue as usual.`,
            loggerCtx
          );
          InvoicePlugin.config.hasValidLicense = false;
        } else {
          InvoicePlugin.config.hasValidLicense = true;
        }
      })
      .catch((err) => {
        Logger.error(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `Error checking license key: ${err?.message}. Viewing invoices is disabled. Invoice generation will continue as usual.`,
          loggerCtx
        );
        InvoicePlugin.config.hasValidLicense = false;
      });
  }

  static init(config: InvoicePluginConfigInput): Type<InvoicePlugin> {
    InvoicePlugin.config = {
      ...config,
      storageStrategy: config.storageStrategy || new LocalFileStrategy(),
      loadDataFn: config.loadDataFn || defaultLoadDataFn,
      hasValidLicense: false,
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
