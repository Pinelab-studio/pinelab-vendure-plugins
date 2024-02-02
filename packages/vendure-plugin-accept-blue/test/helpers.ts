import { gql } from 'graphql-tag';

export const CREATE_PAYMENT_METHOD = gql`
  mutation CreatePaymentMethod($input: CreatePaymentMethodInput!) {
    createPaymentMethod(input: $input) {
      id
    }
  }
`;

export const ADD_ITEM_TO_ORDER = gql`
  mutation AddItemToOrder($productVariantId: ID!, $quantity: Int!) {
    addItemToOrder(productVariantId: $productVariantId, quantity: $quantity) {
      ... on Order {
        id
        code
        totalWithTax
        total
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;

export const TRANSITION_ORDER_TO = gql`
  mutation TransitionOrderToState($state: String!) {
    transitionOrderToState(state: $state) {
      ... on Order {
        id
        code
        totalWithTax
        total
      }
      ... on OrderStateTransitionError {
        errorCode
        message
        transitionError
      }
    }
  }
`;

export const ADD_PAYMENT_TO_ORDER = gql`
  mutation AddPaymentToOrder($input: PaymentInput!) {
    addPaymentToOrder(input: $input) {
      ... on Order {
        id
        code
        totalWithTax
        total
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;

export const SET_SHIPPING_METHOD = gql`
  mutation SetShippingMethod($id: [ID!]!) {
    setOrderShippingMethod(shippingMethodId: $id) {
      ... on Order {
        id
        code
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;
