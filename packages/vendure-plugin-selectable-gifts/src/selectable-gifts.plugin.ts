import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { GiftResolver, shopApiExtensions } from './api/api-extensions';
import { orderLineCustomFields } from './api/custom-fields';
import { freeGiftPromotionAction } from './api/free-gift.promotion-action';
import { minOrdersPlacedPromotionCondition } from './api/placed-orders.promotion-condition';
import { GiftService } from './api/gift.service';

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
    config.promotionOptions.promotionActions.push(freeGiftPromotionAction);
    config.promotionOptions.promotionConditions.push(
      minOrdersPlacedPromotionCondition,
    );
    config.customFields.OrderLine.push(...orderLineCustomFields);
    return config;
  },
})
export class SelectableGiftsPlugin {}
