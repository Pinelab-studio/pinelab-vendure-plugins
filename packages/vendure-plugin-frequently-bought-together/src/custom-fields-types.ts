import { Product } from '@vendure/core';
import {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CustomProductFields,
} from '@vendure/core/dist/entity/custom-entity-fields';

declare module '@vendure/core' {
  interface CustomProductFields {
    frequentlyBoughtWith?: Product[];
  }
}
