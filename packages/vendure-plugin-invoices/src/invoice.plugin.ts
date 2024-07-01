import {
  Logger,
  PluginCommonModule,
  RuntimeVendureConfig,
  Type,
  VendurePlugin,
} from '@vendure/core';
import { OnApplicationBootstrap } from '@nestjs/common';
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
import { PLUGIN_INIT_OPTIONS, loggerCtx } from './constants';
import { InvoiceConfigEntity } from './entities/invoice-config.entity';
import { InvoiceEntity } from './entities/invoice.entity';
import { StorageStrategy } from './strategies/storage-strategy';
import { InvoiceService } from './services/invoice.service';
import {
  LicenseService,
  VendureHubPlugin,
} from '@vendure-hub/vendure-hub-plugin';

export interface InvoicePluginConfig {
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
  loadDataFn: LoadDataFn;
  storageStrategy: StorageStrategy;
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
  compatibility: '^2.2.0',
  configuration: (config: RuntimeVendureConfig) => {
    InvoicePlugin.configure(config);
    return config;
  },
})
export class InvoicePlugin implements OnApplicationBootstrap {
  static config: InvoicePluginConfig;

  constructor(private licenseService: LicenseService) {}

  onApplicationBootstrap(): void {
    this.licenseService
      .checkLicenseKey(
        InvoicePlugin.config.licenseKey,
        '@vendure-hub/pinelab-invoice-plugin'
      )
      .then((result) => {
        if (!result.valid) {
          Logger.error(
            `Your license key is invalid. Make sure to obtain a valid license key from the Vendure Hub if you want to keep using this plugin.`,
            loggerCtx
          );
        }
      })
      .catch((err) => {
        Logger.error(`Error checking license key: ${err?.message}`, loggerCtx);
      });
  }

  static init(
    config: Partial<InvoicePluginConfig> & {
      vendureHost: string;
      licenseKey: string;
    }
  ): Type<InvoicePlugin> {
    InvoicePlugin.config = {
      vendureHost: config.vendureHost,
      storageStrategy: config.storageStrategy || new LocalFileStrategy(),
      loadDataFn: config.loadDataFn || defaultLoadDataFn,
      licenseKey: config.licenseKey,
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

  private static async configure(
    config: RuntimeVendureConfig
  ): Promise<RuntimeVendureConfig> {
    config.authOptions.customPermissions.push(invoicePermission);
    if (this.config.storageStrategy) {
      await this.config.storageStrategy.init();
    }
    return config;
  }
}
