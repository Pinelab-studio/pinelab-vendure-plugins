import { CustomFieldConfig, LanguageCode } from '@vendure/core';
import {
  // Note: we are using a deep import here, rather than importing from `@vendure/core` due to
  // a possible bug in TypeScript (https://github.com/microsoft/TypeScript/issues/46617) which
  // causes issues when multiple plugins extend the same custom fields interface.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CustomProductVariantFields,
} from '@vendure/core/dist/entity/custom-entity-fields';

declare module '@vendure/core' {
  interface CustomProductVariantFields {
    qlsProductId?: string;
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
