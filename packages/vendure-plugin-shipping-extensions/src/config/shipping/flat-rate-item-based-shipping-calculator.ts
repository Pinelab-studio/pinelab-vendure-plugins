import { LanguageCode } from '@vendure/common/lib/generated-types';
import { Injector, RequestContext, ShippingCalculator } from '@vendure/core';
import { getHighestTaxRateOfOrder } from './shipping-util';
import { ShippingExtensionsPlugin } from '../../shipping-extensions.plugin';

export enum TaxSetting {
  include = 'include',
  exclude = 'exclude',
  auto = 'auto',
}

let injector: Injector;

/**
 * This eligibility finds the highest tax rate in cart, and applies that to the shipping cost.
 *
 * In most European countries, shipping tax is prorated according to the tax rate of items in the cart.
 * Vendure does not support multiple tax rates for shipping, so this calculator uses the highest tax rate in the cart.
 */
export const flatRateItemBasedShippingCalculator = new ShippingCalculator({
  code: 'flat-rate-item-based-shipping-calculator',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Flat rate. Tax based on highest tax rate in cart.',
    },
  ],
  args: {
    rate: {
      type: 'int',
      defaultValue: 0,
      ui: { component: 'currency-form-input' },
      label: [{ languageCode: LanguageCode.en, value: 'Shipping price' }],
    },
    includesTax: {
      type: 'string',
      defaultValue: TaxSetting.auto,
      ui: {
        component: 'select-form-input',
        options: [
          {
            label: [{ languageCode: LanguageCode.en, value: 'Includes tax' }],
            value: TaxSetting.include,
          },
          {
            label: [{ languageCode: LanguageCode.en, value: 'Excludes tax' }],
            value: TaxSetting.exclude,
          },
          {
            label: [
              {
                languageCode: LanguageCode.en,
                value: 'Auto (based on Channel)',
              },
            ],
            value: TaxSetting.auto,
          },
        ],
      },
      label: [{ languageCode: LanguageCode.en, value: 'Price includes tax' }],
    },
  },
  init: (_injector) => {
    injector = _injector;
  },
  calculate: async (ctx, order, args, method) => {
    const flatRateSurchargeFn =
      ShippingExtensionsPlugin.options?.flatRateSurchargeFn;
    const [taxRate, surcharge] = await Promise.all([
      getHighestTaxRateOfOrder(ctx, injector, order),
      flatRateSurchargeFn?.(ctx, injector, order, method) || 0,
    ]);
    return {
      price: args.rate + surcharge,
      taxRate,
      priceIncludesTax: priceIncludesTax(ctx, args.includesTax as TaxSetting),
    };
  },
});

function priceIncludesTax(ctx: RequestContext, setting: TaxSetting): boolean {
  switch (setting) {
    case TaxSetting.auto:
      return ctx.channel.pricesIncludeTax;
    case TaxSetting.exclude:
      return false;
    case TaxSetting.include:
      return true;
  }
}
