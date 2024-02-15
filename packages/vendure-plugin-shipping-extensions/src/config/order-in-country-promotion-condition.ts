import {
  CountryService,
  Injector,
  LanguageCode,
  PromotionCondition,
  RequestContext,
} from '@vendure/core';

/**
 * Checks if the order's shipping country is equal to one of the configured countries
 */
export const orderInCountryPromotionCondition = new PromotionCondition({
  code: 'order_in_country',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Shipping country is in one of { countries }',
    },
  ],
  args: {
    countries: {
      type: 'string',
      list: true,
      ui: {
        component: 'select-form-input',
        options: [
          // This is just a placeholder value, and gets replaced in the init method
          {
            value: 'NL',
            label: [{ languageCode: LanguageCode.en, value: 'Nederland' }],
          },
        ],
      },
    },
  },
  async init(injector) {
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
  },
  async check(ctx, order, args) {
    if (!order.shippingAddress?.countryCode) {
      return false;
    }
    return args.countries.includes(order.shippingAddress.countryCode);
  },
});
