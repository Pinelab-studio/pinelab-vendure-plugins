import { gql } from 'graphql-tag';
export const convertToDraftMutation = gql`
  mutation ConvertToDraft($id: ID!) {
    convertOrderToDraft(id: $id) {
      id
      code
      state
      active
      total
      totalWithTax
      customer {
        emailAddress
      }
      shippingAddress {
        fullName
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
  }
`;

export const TRANSITION_ORDER_TO = gql`
  mutation TransitionOrderToState($id: ID!, $state: String!) {
    transitionOrderToState(id: $id, state: $state) {
      ... on Order {
        id
        code
        totalWithTax
        total
        state
        active
      }
      ... on OrderStateTransitionError {
        errorCode
        message
        transitionError
      }
    }
  }
`;
