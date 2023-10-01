import { CustomFieldConfig, LanguageCode } from '@vendure/core';

export const orderLineCustomFields: CustomFieldConfig[] = [
  {
    name: 'subscriptionIds',
    label: [
      {
        languageCode: LanguageCode.en,
        value: 'Downpayment',
      },
    ],
    type: 'string',
    list: true,
    public: false,
    readonly: true,
    internal: true,
    nullable: true,
  },
  {
    name: 'subscriptionHash',
    label: [
      {
        languageCode: LanguageCode.en,
        value: 'Subscription hash',
      },
    ],
    description: [
      {
        languageCode: LanguageCode.en,
        value: 'Unique hash to separate order lines',
      },
    ],
    type: 'string',
    list: true,
    public: false,
    readonly: true,
    internal: true,
    nullable: true,
  },
];
