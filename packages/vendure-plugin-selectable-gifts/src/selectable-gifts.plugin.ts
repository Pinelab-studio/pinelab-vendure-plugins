import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { GiftResolver, shopApiExtensions } from './api-extensions';
import { freeGiftPromotionAction } from './free-gift.promotion-action';
import { GiftService } from './gift.service';

export interface GiftPluginOptions {
  enabled: boolean;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [GiftService],
  shopApiExtensions: {
    resolvers: [GiftResolver],
    schema: shopApiExtensions,
  },
  configuration: (config) => {
    // Add our custom promotion actions and conditions
    config.promotionOptions.promotionActions.push(freeGiftPromotionAction);
    return config;
  },
})
export class SelectableGiftsPlugin {}
