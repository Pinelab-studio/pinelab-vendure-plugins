import { LanguageCode } from '@vendure/common/lib/generated-types';
import { RequestContext, ShippingCalculator } from '@vendure/core';
import { ZoneAwareShippingTaxCalculationService } from '../services/zone-aware-shipping-tax-calculation.service';

export enum TaxSetting {
  include = 'include',
  exclude = 'exclude',
  auto = 'auto',
}

let zoneAwareShippingTaxCalculationService: ZoneAwareShippingTaxCalculationService;

// FIXME: Remove this. Shipping tax should always be dependent on the items in cart!
export const zoneAwareFlatRateShippingCalculator = new ShippingCalculator({
  code: 'zone-aware-flat-rate-shipping-calculator',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Zone aware Flat-Rate Shipping Calculator',
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
    taxCategoryId: {
      type: 'ID',
      ui: { component: 'tax-category-id-form-input' },
      label: [{ languageCode: LanguageCode.en, value: 'Tax Category' }],
    },
  },
  init: (injector) => {
    zoneAwareShippingTaxCalculationService = injector.get(
      ZoneAwareShippingTaxCalculationService
    );
  },
  calculate: async (ctx, order, args) => {
    const taxRate =
      (await zoneAwareShippingTaxCalculationService.getTaxRateForCategory(
        ctx,
        order,
        args.taxCategoryId
      )) ?? 0;
    return {
      price: args.rate,
      taxRate,
      //eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      priceIncludesTax: getPriceIncludesTax(ctx, args.includesTax as any),
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
