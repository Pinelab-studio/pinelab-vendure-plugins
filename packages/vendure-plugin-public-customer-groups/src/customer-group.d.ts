import { CustomCustomerGroupFields } from '@vendure/core/dist/entity/custom-entity-fields';

declare module '@vendure/core/dist/entity/custom-entity-fields' {
  interface CustomCustomerGroupFields {
    isPublic: boolean;
  }
}
