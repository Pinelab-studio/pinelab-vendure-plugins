import {
  CountryService,
  LanguageCode,
  Order,
  Product,
  RequestContext,
  ShippingEligibilityChecker,
  TransactionalConnection,
} from '@vendure/core';
import { ShippingByWeightAndCountryPlugin } from './shipping-by-weight-and-country.plugin';

export function calculateOrderWeight(
  order: Order,
  products: Product[]
): number {
  return order.lines.reduce((acc, line) => {
    const product = products.find(
      (p) => p.id === line.productVariant.productId
    );
    const weight =
      (line.productVariant.customFields as any).weight ??
      (product?.customFields as any).weight ??
      0;
    const lineWeight = weight * line.quantity;
    return acc + lineWeight;
  }, 0);
}

let connection: TransactionalConnection;
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
    connection = injector.get(TransactionalConnection);
    const ctx = RequestContext.empty();
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
    this.args.minWeight.description = [
      {
        languageCode: LanguageCode.en,
        value: `Minimum weight in ${ShippingByWeightAndCountryPlugin.options?.weightUnit}`,
      },
    ];
    this.args.maxWeight.description = [
      {
        languageCode: LanguageCode.en,
        value: `Maximum weight in ${ShippingByWeightAndCountryPlugin.options?.weightUnit}`,
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
      ? countries.indexOf(shippingCountry) > -1
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
    const products = await connection.findByIdsInChannel(
      ctx,
      Product,
      productIds,
      ctx.channelId,
      {}
    );
    const totalOrderWeight = calculateOrderWeight(order, products);
    return totalOrderWeight <= maxWeight && totalOrderWeight >= minWeight;
  },
});
