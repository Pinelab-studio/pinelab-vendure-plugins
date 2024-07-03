import { LanguageCode } from '@vendure/common/lib/generated-types';
import { InitialData } from '@vendure/core';

export const initialTestData: InitialData = {
  defaultLanguage: LanguageCode.en,
  defaultZone: 'Europe',
  taxRates: [
    { name: 'Standard Tax', percentage: 20 },
    { name: 'Reduced Tax', percentage: 10 },
    { name: 'Zero Tax', percentage: 0 },
  ],
  shippingMethods: [
    { name: 'Standard Shipping', price: 500 },
    { name: 'Express Shipping', price: 1000 },
  ],
  countries: [
    { name: 'Australia', code: 'AU', zone: 'Oceania' },
    { name: 'Austria', code: 'AT', zone: 'Europe' },
    { name: 'Canada', code: 'CA', zone: 'Americas' },
    { name: 'China', code: 'CN', zone: 'Asia' },
    { name: 'South Africa', code: 'ZA', zone: 'Africa' },
    { name: 'United Kingdom', code: 'GB', zone: 'Europe' },
    { name: 'United States of America', code: 'US', zone: 'Americas' },
    { name: 'Nederland', code: 'NL', zone: 'Europe' },
  ],
  collections: [
    {
      name: 'Computers',
      filters: [
        {
          code: 'facet-value-filter',
          args: { facetValueNames: ['computers'], containsAny: false },
        },
      ],
    },
    {
      name: 'Electronics',
      filters: [
        {
          code: 'facet-value-filter',
          args: { facetValueNames: ['electronics'], containsAny: false },
        },
      ],
      private: true,
    },
    {
      name: 'Others',
      filters: [
        {
          code: 'facet-value-filter',
          args: { facetValueNames: ['others'], containsAny: false },
        },
      ],
    },
    {
      name: 'Hardware',
      filters: [
        {
          code: 'facet-value-filter',
          args: { facetValueNames: ['hardware'], containsAny: false },
        },
      ],
    },
  ],
  paymentMethods: [],
};
