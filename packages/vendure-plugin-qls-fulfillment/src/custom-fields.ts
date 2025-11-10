import { LanguageCode, type CustomFieldConfig } from '@vendure/core';

declare module '@vendure/core' {
  interface CustomProductVariantFields {
    qlsFulfillmentProductId?: string;
  }
}

export const customProductVariantFields: CustomFieldConfig[] = [
  {
    name: 'qlsFulfillmentProductId',
    label: [
      {
        languageCode: LanguageCode.en,
        value: 'QLS Fulfillment Product ID',
      },
    ],
    type: 'string',
    internal: true,
  },
];
