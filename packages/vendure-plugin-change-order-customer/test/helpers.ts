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
export const ADDRESS_FRAGMENT = gql`
  fragment Address on Address {
    id
    fullName
    company
    streetLine1
    streetLine2
    city
    province
    postalCode
    country {
      id
      code
      name
    }
    phoneNumber
    defaultShippingAddress
    defaultBillingAddress
  }
`;

export const CUSTOMER_FRAGMENT = gql`
  fragment Customer on Customer {
    id
    title
    firstName
    lastName
    phoneNumber
    emailAddress
    user {
      id
      identifier
      verified
      lastLogin
    }
    addresses {
      ...Address
    }
  }
  ${ADDRESS_FRAGMENT}
`;
export const GET_ANY_CUSTOMER = gql`
  query GetAnyCustomer {
    customers(options: { take: 1 }) {
      items {
        ...Customer
      }
    }
  }
  ${CUSTOMER_FRAGMENT}
`;
