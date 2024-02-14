import {
  CountryService,
  EntityHydrator,
  LanguageCode,
  Order,
  RequestContext,
  ShippingEligibilityChecker,
} from '@vendure/core';
import { ShippingExtensionsPlugin } from '../shipping-extensions.plugin';

export function calculateOrderWeight(order: Order): number {
  return order.lines.reduce((acc, line) => {
    const weight =
      (line.productVariant.customFields as any).weight ??
      (line.productVariant.product?.customFields as any).weight ??
      0;
    const lineWeight = weight * line.quantity;
    return acc + lineWeight;
  }, 0);
}

let entityHydrator: EntityHydrator;
export const weightAndCountryChecker = new ShippingEligibilityChecker({
  code: 'shipping-by-weight-and-country',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Check by weight and country',
    },
  ],
  args: {
    minWeight: {
      type: 'int',
      description: [{ languageCode: LanguageCode.en, value: `Minimum weight` }],
    },
    maxWeight: {
      type: 'int',
      description: [{ languageCode: LanguageCode.en, value: `Maximum weight` }],
    },
    countries: {
      type: 'string',
      list: true,
      ui: {
        component: 'select-form-input',
        options: [
          {
            value: 'nl',
            label: [{ languageCode: LanguageCode.en, value: 'Nederland' }],
          },
        ],
      },
    },
    excludeCountries: {
      type: 'boolean',
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Eligible for all countries except the ones listed above',
        },
      ],
      ui: {
        component: 'boolean-form-input',
      },
    },
  },
  async init(injector) {
    entityHydrator = injector.get(EntityHydrator);
    const ctx = RequestContext.empty();
    // Populate the countries arg list
    const countries = await injector.get(CountryService).findAll(ctx);
    this.args.countries.ui.options = countries.items.map((c) => ({
      value: c.code,
      label: [
        {
          languageCode: LanguageCode.en,
          value: c.name,
        },
      ],
    }));
    // Set the description based on the given weight unit.
    // This needs to happen in `init`, because plugin.options are otherwise not available
    this.args.minWeight.description = [
      {
        languageCode: LanguageCode.en,
        value: `Minimum weight in ${ShippingExtensionsPlugin.options?.weightUnit}`,
      },
    ];
    this.args.maxWeight.description = [
      {
        languageCode: LanguageCode.en,
        value: `Maximum weight in ${ShippingExtensionsPlugin.options?.weightUnit}`,
      },
    ];
  },
  async check(
    ctx,
    order,
    { minWeight, maxWeight, countries, excludeCountries }
  ) {
    const shippingCountry = order.shippingAddress.countryCode;
    const orderIsInSelectedCountry = shippingCountry
      ? countries.includes(shippingCountry)
      : false;
    if (orderIsInSelectedCountry && excludeCountries) {
      // Not eligible, because order.country is in our excluded-country-list
      return false;
    }
    if (!orderIsInSelectedCountry && !excludeCountries) {
      // Not eligible, because order.country is not in our list, but it should be
      return false;
    }
    // Shipping country is allowed, continue checking order weight
    const productIds = order.lines.map((line) => line.productVariant.productId);
    await entityHydrator.hydrate(ctx, order, {
      relations: [
        'lines',
        'lines.productVariant',
        'lines.productVariant.product',
      ],
    });
    let totalOrderWeight = 0;
    if (ShippingExtensionsPlugin.options?.weightCalculationFunction) {
      totalOrderWeight =
        ShippingExtensionsPlugin.options.weightCalculationFunction(order);
    } else {
      totalOrderWeight = calculateOrderWeight(order);
    }
    return totalOrderWeight <= maxWeight && totalOrderWeight >= minWeight;
  },
});
