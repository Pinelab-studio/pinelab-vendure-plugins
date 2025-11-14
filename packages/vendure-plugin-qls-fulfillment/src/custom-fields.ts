import { CustomFieldConfig, LanguageCode } from '@vendure/core';
import {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CustomProductVariantFields,
} from '@vendure/core/dist/entity/custom-entity-fields';

declare module '@vendure/core' {
  interface CustomProductVariantFields {
    qlsProductId?: string;
  }
}

const uiTab = 'QLS';

export const variantCustomFields: CustomFieldConfig[] = [
  {
    name: 'qlsProductId',
    type: 'string',
    label: [{ value: 'QLS Product ID', languageCode: LanguageCode.en }],
    nullable: true,
    public: false,
    ui: { tab: uiTab },
  },
];
