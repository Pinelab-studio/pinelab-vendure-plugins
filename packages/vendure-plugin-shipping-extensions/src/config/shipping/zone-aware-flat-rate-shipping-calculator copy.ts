import { Injector, RequestContext, ShippingCalculator } from '@vendure/core';
import { flatRateItemBasedShippingCalculator } from './flat-rate-item-based-shipping-calculator';
import { getHighestTaxRateOfOrder } from './shipping-util';

export enum TaxSetting {
  include = 'include',
  exclude = 'exclude',
  auto = 'auto',
}

let injector: Injector;

/**
 * @deprecated Use `flatRateItemBasedShippingCalculator` instead.
 *
 * This already uses the Flat Rate Item Based calculator, but the code is still `zone-aware-flat-rate-shipping-calculator`
 * for easier migration.
 */
export const zoneAwareFlatRateShippingCalculator = new ShippingCalculator({
  code: 'zone-aware-flat-rate-shipping-calculator',
  description: flatRateItemBasedShippingCalculator.description,
  args: flatRateItemBasedShippingCalculator.args,
  init: (_injector) => {
    injector = _injector;
  },
  calculate: async (ctx, order, args) => {
    const taxRate = await getHighestTaxRateOfOrder(ctx, injector, order);
    return {
      price: args.rate,
      taxRate,
      priceIncludesTax: getPriceIncludesTax(
        ctx,
        args.includesTax as TaxSetting
      ),
    };
  },
});

function getPriceIncludesTax(
  ctx: RequestContext,
  setting: TaxSetting
): boolean {
  switch (setting) {
    case TaxSetting.auto:
      return ctx.channel.pricesIncludeTax;
    case TaxSetting.exclude:
      return false;
    case TaxSetting.include:
      return true;
  }
}
