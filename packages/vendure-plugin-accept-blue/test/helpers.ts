import { gql } from 'graphql-tag';

const ACCEPT_BLUE_PAYMENT_METHOD_FRAGMENT = gql`
  fragment AcceptBluePaymentMethodFields on AcceptBluePaymentMethod {
    ... on AcceptBlueCardPaymentMethod {
      id
      created_at
      name
      payment_method_type
      last4
      avs_address
      avs_zip
      expiry_month
      expiry_year
      card_type
    }
    ... on AcceptBlueCheckPaymentMethod {
      id
      created_at
      name
      payment_method_type
      last4
      created_at
      account_number
      routing_number
      account_type
      sec_code
    }
  }
`;

export const CREATE_PAYMENT_METHOD = gql`
  mutation CreatePaymentMethod($input: CreatePaymentMethodInput!) {
    createPaymentMethod(input: $input) {
      id
      code
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
        lines {
          id
          acceptBlueSubscriptions {
            name
            variantId
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
        state
        lines {
          id
          customFields {
            subscriptionIds
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

export const GET_USER_SAVED_PAYMENT_METHOD = gql`
  query GetUserSavedPaymentMethod {
    activeCustomer {
      savedAcceptBluePaymentMethods {
        ...AcceptBluePaymentMethodFields
      }
    }
  }
  ${ACCEPT_BLUE_PAYMENT_METHOD_FRAGMENT}
`;

export const PREVIEW_SUBSCRIPTIONS_FOR_VARIANT = gql`
  query previewAcceptBlueSubscriptions($productVariantId: ID!) {
    previewAcceptBlueSubscriptions(productVariantId: $productVariantId) {
      name
      variantId
    }
  }
`;

export const PREVIEW_SUBSCRIPTIONS_FOR_PRODUCT = gql`
  query previewAcceptBlueSubscriptionsForProduct($productId: ID!) {
    previewAcceptBlueSubscriptionsForProduct(productId: $productId) {
      name
    }
  }
`;

export const GET_CUSTOMER_WITH_ID = gql`
  query GetCustomerWithId($id: ID!) {
    customer(id: $id) {
      savedAcceptBluePaymentMethods {
        ...AcceptBluePaymentMethodFields
      }
    }
  }
  ${ACCEPT_BLUE_PAYMENT_METHOD_FRAGMENT}
`;

export const UPDATE_CUSTOMER_BLUE_ID = gql`
  mutation UpdateCustomer($customerId: ID!, $activeBlueCustomerId: Int!) {
    updateCustomer(
      input: {
        id: $customerId
        customFields: { activeBlueCustomerId: $activeBlueCustomerId }
      }
    ) {
      ... on Customer {
        id
        emailAddress
      }
      ... on ErrorResult {
        message
      }
    }
  }
`;
