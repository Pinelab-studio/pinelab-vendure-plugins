import {
  assertFound,
  CountryService,
  Injector,
  LanguageCode,
  Order,
  OrderService,
  RequestContext,
  ShippingEligibilityChecker,
} from '@vendure/core';
import { ShippingExtensionsPlugin } from '../../shipping-extensions.plugin';
import { isEligibleForCountry } from './shipping-util';

export function calculateOrderWeight(order: Order): number {
  return order.lines.reduce((acc, line) => {
    //eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const weight =
      //eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      (line.productVariant.customFields as any).weight ??
      //eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      (line.productVariant.product?.customFields as any).weight ??
      0;
    const lineWeight = weight * line.quantity;
    return acc + lineWeight;
  }, 0);
}
let injector: Injector;
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
  async init(_injector) {
    injector = _injector;
    const ctx = RequestContext.empty();
    // Populate the countries arg list
    const countries = await _injector.get(CountryService).findAll(ctx);
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
    _order,
    { minWeight, maxWeight, countries, excludeCountries },
    method
  ) {
    const isEligibleByCountry = isEligibleForCountry(
      _order,
      countries,
      excludeCountries
    );
    if (isEligibleByCountry === false) {
      return false;
    }
    // Shipping country is allowed, continue checking order weight
    const hydratedOrder = await assertFound(
      injector
        .get(OrderService)
        .findOne(ctx, _order.id, [
          'lines',
          'lines.productVariant',
          'lines.productVariant.product',
        ])
    );
    let totalOrderWeight = 0;
    if (ShippingExtensionsPlugin.options?.weightCalculationFunction) {
      totalOrderWeight =
        await ShippingExtensionsPlugin.options.weightCalculationFunction(
          ctx,
          hydratedOrder,
          injector
        );
    } else {
      totalOrderWeight = calculateOrderWeight(hydratedOrder);
    }
    const isBetweenWeights =
      totalOrderWeight <= maxWeight && totalOrderWeight >= minWeight;
    if (!isBetweenWeights) {
      return false;
    }
    // Check for additional consumer provided isEligible check as final option to block eligibility
    const additionalIsEligible =
      await ShippingExtensionsPlugin.options.additionalShippingEligibilityCheck?.(
        ctx,
        injector,
        hydratedOrder,
        method
      );
    if (additionalIsEligible === false) {
      return false;
    }
    return true;
  },
});
