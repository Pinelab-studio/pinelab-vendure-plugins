import { gql } from 'graphql-tag';

export const OrderFieldsFragment = gql`
  fragment OrderFields on Order {
    id
    orderPlacedAt
    code
    state
    active
    total
    totalWithTax
    shippingWithTax
    couponCodes
    shippingAddress {
      fullName
      company
      streetLine1
      streetLine2
      city
      postalCode
      country
    }
    billingAddress {
      fullName
      company
      streetLine1
      streetLine2
      city
      postalCode
      country
    }
    customer {
      id
      firstName
      lastName
      emailAddress
    }
    lines {
      id
      quantity
      productVariant {
        id
      }
      discounts {
        adjustmentSource
        amount
        amountWithTax
        description
        type
      }
    }
  }
`;
export const GET_ACTIVE_ORDER = gql`
  ${OrderFieldsFragment}
  query GetActiveOrder {
    activeOrder {
      ... on Order {
        ...OrderFields
      }
    }
  }
`;
export const ANONYMIZED_ORDER_QUERY = gql`
  ${OrderFieldsFragment}
  query anonymizedOrderQuery($orderCode: String!, $emailAddress: String!) {
    anonymizedOrder(orderCode: $orderCode, emailAddress: $emailAddress) {
      ...OrderFields
    }
  }
`;
