import {
  CustomCustomerFields,
  CustomOrderLineFields,
} from '@vendure/core/dist/entity/custom-entity-fields';

declare module '@vendure/core/dist/entity/custom-entity-fields' {
  interface CustomCustomerFields {
    activeBlueCustomerId: number;
  }

  interface CustomOrderLineFields {
    subscriptionIds: number[];
  }
}
