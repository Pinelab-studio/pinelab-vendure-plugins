import { Customer, CustomFields, LanguageCode } from '@vendure/core';

export const customFields: CustomFields = {
  CustomerGroup: [
    {
      name: 'groupAdmin',
      list: true,
      type: 'relation',
      entity: Customer,
      graphQLType: 'Customer',
      public: true,
      nullable: true,
      eager: false,
      readonly: false,
      label: [
        {
          languageCode: LanguageCode.en,
          value: 'Administrators of this group',
        },
      ],
      // ui: { component: 'customer-group-admin-selector' },
    },
  ],
};
