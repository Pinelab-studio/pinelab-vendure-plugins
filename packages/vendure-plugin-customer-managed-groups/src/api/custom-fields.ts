import {
  CustomerGroup,
  Customer,
  CustomFields,
  LanguageCode,
} from '@vendure/core';

export interface CustomerGroupWithCustomFields extends CustomerGroup {
  customFields: {
    isCustomerManaged?: boolean;
    groupAdmins?: Customer[];
  };
}

export interface CustomerWithCustomFields extends Customer {
  groups: CustomerGroupWithCustomFields[];
}

export const customFields: CustomFields = {
  CustomerGroup: [
    {
      name: 'groupAdmins',
      list: true,
      type: 'relation',
      entity: Customer,
      graphQLType: 'Customer',
      public: true,
      nullable: true,
      eager: true,
      readonly: false,
      label: [
        {
          languageCode: LanguageCode.en,
          value: 'Administrators of this group',
        },
      ],
      // ui: { component: 'customer-group-admin-selector' },
    },
    {
      name: 'isCustomerManaged',
      type: 'boolean',
      public: false,
      nullable: true,
      label: [
        {
          languageCode: LanguageCode.en,
          value: 'Is customer managed',
        },
      ],
    },
  ],
};
