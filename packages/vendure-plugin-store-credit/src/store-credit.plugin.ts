import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { Wallet } from './entities/wallet.entity';
import { WalletAdjustment } from './entities/wallet-adjustment.entity';
import { WalletService } from './services/wallet.service';
import { adminApiExtensions, commonApiExtension } from './api/api-extensions';
import { CustomerEntityResolver } from './api/customer-entity.resolver';
import { WalletResolver } from './api/wallet.resolver';

@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [Wallet, WalletAdjustment],
  providers: [WalletService],
  shopApiExtensions: {
    schema: commonApiExtension,
    resolvers: [CustomerEntityResolver],
  },
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [CustomerEntityResolver, WalletResolver],
  },
})
export class StoreCreditPlugin {}
