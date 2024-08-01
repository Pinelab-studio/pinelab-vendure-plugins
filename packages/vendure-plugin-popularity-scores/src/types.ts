import {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  CustomProductFields,
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
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
