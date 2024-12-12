import {
  LanguageCode,
  Logger,
  PluginCommonModule,
  Product,
  Type,
  VendurePlugin,
} from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';

import {
  FREQUENTLY_BOUGHT_TOGETHER_PLUGIN_OPTIONS,
  loggerCtx,
} from './constants';
import { FrequentlyBoughtTogetherService } from './services/frequently-bought-together.service';
import { PluginInitOptions } from './types';
import path from 'path';
import { adminApiExtensions, shopApiExtensions } from './api/api-extensions';
import { FrequentlyBoughtTogetherAdminResolver } from './api/frequently-bought-together-admin.resolver';
import { OnApplicationBootstrap } from '@nestjs/common';
import {
  LicenseService,
  VendureHubPlugin,
} from '@vendure-hub/vendure-hub-plugin';
import { asError } from 'catch-unknown';
import { FrequentlyBoughtTogetherShopResolver } from './api/frequently-bought-together-shop.resolver';

export type FrequentlyBoughtTogetherPluginOptions = Partial<
  Omit<PluginInitOptions, 'hasValidLicense'>
> &
  Pick<PluginInitOptions, 'licenseKey'>;

/**
 * Increase revenue by cross selling frequently bought together products.
 *
 * @category Plugin
 */
@VendurePlugin({
  imports: [PluginCommonModule, VendureHubPlugin],
  providers: [
    {
      provide: FREQUENTLY_BOUGHT_TOGETHER_PLUGIN_OPTIONS,
      useFactory: () => FrequentlyBoughtTogetherPlugin.options,
    },
    FrequentlyBoughtTogetherService,
  ],
  configuration: (config) => {
    // Set custom product to product relation
    config.customFields.Product.push({
      name: 'frequentlyBoughtWith',
      type: 'relation',
      label: [
        { languageCode: LanguageCode.en, value: 'Frequently bought with' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value:
            'Products which are frequently bought together with these products',
        },
      ],
      list: true,
      entity: Product,
      public: false,
      readonly: false,
      eager: false,
      nullable: true,
      ui: { tab: FrequentlyBoughtTogetherPlugin.options.customFieldUiTab },
    });
    // Set custom field for storing the support per product
    config.customFields.Product.push({
      name: 'frequentlyBoughtWithSupport',
      type: 'text',
      internal: true,
      public: false,
      nullable: true,
    });
    return config;
  },
  compatibility: '>=2.2.0',
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [FrequentlyBoughtTogetherAdminResolver],
  },
  shopApiExtensions: {
    schema: shopApiExtensions,
    resolvers: [FrequentlyBoughtTogetherShopResolver],
  },
})
export class FrequentlyBoughtTogetherPlugin implements OnApplicationBootstrap {
  static options: PluginInitOptions = {
    licenseKey: '',
    customFieldUiTab: 'Related products',
    experimentMode: false,
    supportLevel: 0.01,
    maxRelatedProducts: 10,
    hasValidLicense: false,
  };

  constructor(private licenseService: LicenseService) {}

  onApplicationBootstrap() {
    this.licenseService
      .checkLicenseKey(
        FrequentlyBoughtTogetherPlugin.options.licenseKey,
        '@vendure-hub/pinelab-frequently-bought-together-plugin'
      )
      .then((result) => {
        if (!result.valid) {
          Logger.error(
            `Your license key is invalid. Make sure to obtain a valid license key from the Vendure Hub if you want to keep using this plugin.`,
            loggerCtx
          );
          FrequentlyBoughtTogetherPlugin.options.hasValidLicense = false;
        } else {
          FrequentlyBoughtTogetherPlugin.options.hasValidLicense = true;
        }
      })
      .catch((err) => {
        Logger.error(
          `Error checking license key: ${
            asError(err).message
          }. Some functionality might be disabled`,
          loggerCtx
        );
        FrequentlyBoughtTogetherPlugin.options.hasValidLicense = false;
      });
  }

  static init(
    options: FrequentlyBoughtTogetherPluginOptions
  ): Type<FrequentlyBoughtTogetherPlugin> {
    this.options = {
      ...this.options,
      ...options,
    };
    return FrequentlyBoughtTogetherPlugin;
  }

  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    providers: ['providers.ts'],
  };
}
