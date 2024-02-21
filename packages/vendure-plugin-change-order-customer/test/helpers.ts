import { gql } from 'graphql-tag';

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
      id
      customer {
        id
        emailAddress
        firstName
        lastName
      }
    }
  }
`;
