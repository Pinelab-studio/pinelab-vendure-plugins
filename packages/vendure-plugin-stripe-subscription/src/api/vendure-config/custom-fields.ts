import { CustomFieldConfig, LanguageCode } from '@vendure/core';

export const orderLineCustomFields: CustomFieldConfig[] = [
  {
    name: 'subscriptionIds',
    label: [
      {
        languageCode: LanguageCode.en,
        value: 'Subscription IDs',
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
