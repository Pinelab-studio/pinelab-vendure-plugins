import { CustomProductVariantFields } from '@vendure/core/dist/entity/custom-entity-fields';

declare module '@vendure/core' {
  interface CustomProductVariantFields {
    maxPerOrder: number;
    onlyAllowPer: number;
  }
}
