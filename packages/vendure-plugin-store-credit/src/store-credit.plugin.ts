import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { WalletAdjustment } from './entities/wallet-adjustment.entity';
import { Wallet } from './entities/wallet.entity';
import { WalletService } from './services/wallet.service';
import { adminApiExtensions, commonApiExtension } from './api/api-extensions';
import { CommonResolver } from './api/common.resolver';
import { AdminResolver } from './api/admin.resolver';
import { storeCreditPaymentHandler } from './config/payment-method-handler';
import { RefundStoreCreditService } from './services/refund-store-credit.service';

@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [WalletAdjustment, Wallet],
  providers: [WalletService, RefundStoreCreditService],
  shopApiExtensions: {
    schema: commonApiExtension,
    resolvers: [CommonResolver],
  },
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [CommonResolver, AdminResolver],
  },
  configuration: (config) => {
    config.paymentOptions.paymentMethodHandlers.push(storeCreditPaymentHandler);
    return config;
  },
})
export class StoreCreditPlugin {}
