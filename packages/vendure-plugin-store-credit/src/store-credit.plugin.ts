import {
  LanguageCode,
  PluginCommonModule,
  Type,
  VendurePlugin,
} from '@vendure/core';
import { AdminResolver } from './api/admin.resolver';
import { adminApiExtensions, commonApiExtension } from './api/api-extensions';
import { CommonResolver } from './api/common.resolver';
import { storeCreditPaymentHandler } from './config/payment-method-handler';
import { STORE_CREDIT_PLUGIN_OPTIONS } from './constants';
import { Wallet } from './entities/wallet.entity';
import { WalletAdjustment } from './entities/wallet-adjustment.entity';
import { WalletService } from './services/wallet.service';
import { StoreCreditPluginOptions } from './types';

@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [WalletAdjustment, Wallet],
  providers: [
    {
      provide: STORE_CREDIT_PLUGIN_OPTIONS,
      useFactory: () => StoreCreditPlugin.options,
    },
    WalletService,
  ],
  shopApiExtensions: {
    schema: commonApiExtension,
    resolvers: [CommonResolver],
  },
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [CommonResolver, AdminResolver],
  },
  configuration: (config) => {
    config.customFields = {
      ...config.customFields,
      OrderLine: [
        ...(config.customFields?.OrderLine ?? []),
        {
          name: 'giftCardCodes',
          type: 'string',
          list: true,
          nullable: true,
          label: [{ languageCode: LanguageCode.en, value: 'Gift Card Codes' }],
        },
      ],
    };
    config.paymentOptions.paymentMethodHandlers.push(storeCreditPaymentHandler);
    return config;
  },
  dashboard: './dashboard/index.tsx',
})
export class StoreCreditPlugin {
  static options: StoreCreditPluginOptions;

  static init(options: StoreCreditPluginOptions): Type<StoreCreditPlugin> {
    StoreCreditPlugin.options = options;
    return StoreCreditPlugin;
  }
}
