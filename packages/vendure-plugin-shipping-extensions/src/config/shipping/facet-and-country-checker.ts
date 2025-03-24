import {
  CountryService,
  FacetValueChecker,
  Injector,
  LanguageCode,
  RequestContext,
  ShippingEligibilityChecker,
} from '@vendure/core';
import { isEligibleForCountry } from './shipping-util';
import { ShippingExtensionsPlugin } from '../../shipping-extensions.plugin';

let injector: Injector;

/**
 * Checks if an order only has items with given facets
 */
export const facetAndCountryChecker = new ShippingEligibilityChecker({
  code: 'shipping-by-facets-and-country',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Check by facets and country',
    },
  ],
  args: {
    facets: {
      type: 'ID',
      list: true,
      label: [{ languageCode: LanguageCode.en, value: `Facets` }],
      description: [
        {
          languageCode: LanguageCode.en,
          value: `All items in order should have all of the facets`,
        },
      ],
      ui: {
        component: 'facet-value-form-input',
      },
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
  },
  async check(ctx, order, { facets, countries, excludeCountries }, method) {
    const isEligibleByCountry = isEligibleForCountry(
      order,
      countries,
      excludeCountries
    );
    if (isEligibleByCountry === false) {
      return false;
    }
    // Shipping country is allowed, continue checking facets
    for (const line of order.lines) {
      const hasFacetValues = await injector
        .get(FacetValueChecker)
        .hasFacetValues(line, facets);
      if (!hasFacetValues) {
        // One of the lines doesn't have the facetValue, no need to check any more
        return false;
      }
    }
    // Check for additional consumer provided isEligible check as final option to block eligibility
    const additionalIsEligible =
      await ShippingExtensionsPlugin.options.additionalShippingEligibilityCheck?.(
        ctx,
        injector,
        order,
        method
      );
    if (additionalIsEligible === false) {
      return false;
    }
    return true;
  },
});
