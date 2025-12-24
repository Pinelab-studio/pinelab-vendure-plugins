import { CustomFieldConfig, LanguageCode } from '@vendure/core';
import {
  // Note: we are using a deep import here, rather than importing from `@vendure/core` due to
  // a possible bug in TypeScript (https://github.com/microsoft/TypeScript/issues/46617) which
  // causes issues when multiple plugins extend the same custom fields interface.
  /* eslint-disable @typescript-eslint/no-unused-vars */
  CustomProductVariantFields,
  CustomOrderFields,
} from '@vendure/core/dist/entity/custom-entity-fields';

declare module '@vendure/core' {
  interface CustomProductVariantFields {
    qlsProductId?: string;
  }

  interface CustomOrderFields {
    qlsServicePointId?: string;
    qlsServicePointDetails?: string;
    syncedToQls?: boolean;
  }
}

export const variantCustomFields: CustomFieldConfig[] = [
  {
    name: 'qlsProductId',
    type: 'string',
    label: [{ value: 'QLS Product ID', languageCode: LanguageCode.en }],
    nullable: true,
    public: false,
    readonly: true,
    ui: { tab: 'QLS' },
  },
];

export const orderCustomFields: CustomFieldConfig[] = [
  {
    name: 'qlsServicePointId',
    type: 'string',
    label: [{ value: 'QLS Service Point ID', languageCode: LanguageCode.en }],
    nullable: true,
    public: true,
    readonly: false,
    ui: { tab: 'QLS' },
  },
  {
    name: 'syncedToQls',
    type: 'boolean',
    label: [
      { value: 'Created in QLS', languageCode: LanguageCode.en },
      { value: 'Aangemaakt in QLS', languageCode: LanguageCode.nl },
    ],
    description: [
      {
        value: 'Uncheck this to be able to push the order to QLS again',
        languageCode: LanguageCode.en,
      },
      {
        value: 'Vink dit uit om de order opnieuw naar QLS te sturen',
        languageCode: LanguageCode.nl,
      },
    ],
    nullable: true,
    public: false,
    readonly: false,
    ui: { tab: 'QLS' },
  },
  {
    name: 'qlsServicePointDetails',
    type: 'string',
    label: [
      { value: 'QLS Service Point Details', languageCode: LanguageCode.en },
    ],
    description: [
      {
        value: 'Only used for display purposes.',
        languageCode: LanguageCode.en,
      },
    ],
    nullable: true,
    public: true,
    readonly: false,
    ui: { tab: 'QLS' },
  },
];
