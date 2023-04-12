import {
  CustomProductFields,
  CustomCollectionFields,
} from '@vendure/core/dist/entity/custom-entity-fields';

declare module '@vendure/core/dist/entity/custom-entity-fields' {
  interface CustomProductFields {
    popularityScore: number;
  }

  interface CustomCollectionFields {
    popularityScore: number;
  }
}
