import {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CustomCustomerFields,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CustomOrderLineFields,
} from '@vendure/core/dist/entity/custom-entity-fields';

declare module '@vendure/core/dist/entity/custom-entity-fields' {
  interface CustomCustomerFields {
    acceptBlueCustomerId: number;
  }

  interface CustomOrderLineFields {
    acceptBlueSubscriptionIds: number[];
  }
}
