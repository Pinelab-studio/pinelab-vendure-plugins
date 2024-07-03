/* eslint-disable @typescript-eslint/no-unused-vars */
import { CustomProductFields } from '@vendure/core/dist/entity/custom-entity-fields';
import { Collection } from '@vendure/core';
declare module '@vendure/core/dist/entity/custom-entity-fields' {
  interface CustomProductFields {
    primaryCollection: string[];
  }
}
