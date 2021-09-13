import gql from 'graphql-tag';

export const ADD_ITEM_TO_ORDER = gql`
  mutation AddItemToOrder($productVariantId: ID!, $quantity: Int!) {
    addItemToOrder(productVariantId: $productVariantId, quantity: $quantity) {
      ... on Order {
        id
        code
        state
        active
        total
        totalWithTax
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
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;
export const CREATE_SHIPPING_METHOD = gql`
  mutation CreateShippingMethod($input: CreateShippingMethodInput!) {
    createShippingMethod(input: $input) {
      id
    }
  }
`;

export const SET_SHIPPING_ADDRESS = gql`
  mutation SetShippingAddress($input: CreateAddressInput!) {
    setOrderShippingAddress(input: $input) {
      ... on Order {
        id
      }
    }
  }
`;

export const SET_SHIPPING_METHOD = gql`
  mutation SetShippingMethod($id: ID!) {
    setOrderShippingMethod(shippingMethodId: $id) {
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;

export const TRANSITION_TO_STATE = gql`
  mutation TransitionToState($state: String!) {
    transitionOrderToState(state: $state) {
      ... on OrderStateTransitionError {
        errorCode
      }
    }
  }
`;

export const ADD_PAYMENT = gql`
  mutation AddPaymentToOrder($input: PaymentInput!) {
    addPaymentToOrder(input: $input) {
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;

export const CREATE_PAYMENT_METHOD = gql`
  mutation CreatePaymentMethod($input: CreatePaymentMethodInput!) {
    createPaymentMethod(input: $input) {
      id
    }
  }
`;

export const FULFILL = gql`
    mutation CreateFulfillment($input: FulfillOrderInput!) {
        addFulfillmentToOrder(input: $input) {
            ...on Fulfillment {
                id
                state
            }
        }
    }
`;
