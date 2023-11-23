import { LanguageCode, Logger, PromotionItemAction } from '@vendure/core';
import { loggerCtx } from '../constants';

export const freeGiftPromotionAction = new PromotionItemAction({
  code: 'selectable_gifts',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Allow selected products as free gift',
    },
  ],
  args: {
    variants: {
      type: 'ID',
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'One of these products can be selected as gift',
        },
      ],
      list: true,
      ui: { component: 'product-selector-form-input' },
    },
  },
  init(injector) {},
  async execute(ctx, orderLine, args, state) {
    if ((orderLine.customFields as any).isSelectedAsGift) {
      Logger.verbose(
        `Discounting 1 ${orderLine.productVariant.name} (order line ${orderLine.id}) because it's selected as gift`,
        loggerCtx
      );
      const unitPrice = ctx.channel.pricesIncludeTax
        ? orderLine.unitPriceWithTax
        : orderLine.unitPrice;
      return -unitPrice;
    }
    return 0;
  },
});
