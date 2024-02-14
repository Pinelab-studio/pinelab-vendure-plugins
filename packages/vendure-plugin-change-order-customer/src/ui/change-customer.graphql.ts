import { gql } from 'graphql-tag';
import { ORDER_DETAIL_FRAGMENT } from '@vendure/admin-ui/core';

export const CHANGE_ORDER_CUSTOMER = gql`
  mutation ChangeOrderCustomer(
    $orderId: ID!
    $customerId: ID
    $input: CreateCustomerInput
  ) {
    setCustomerForOrder(
      orderId: $orderId
      customerId: $customerId
      input: $input
    ) {
      ...OrderDetail
    }
  }
  ${ORDER_DETAIL_FRAGMENT}
`;
