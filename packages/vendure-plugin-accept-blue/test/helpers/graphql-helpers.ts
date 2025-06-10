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

export const ADMIN_CREATE_CARD_PAYMENT_METHOD = gql`
  mutation CreateCardPaymentMethod(
    $input: CreateAcceptBlueCardPaymentMethodInput!
    $customerId: Int!
  ) {
    createAcceptBlueCardPaymentMethod(input: $input, customerId: $customerId) {
      id
      created_at
      avs_address
      avs_zip
      name
      expiry_month
      expiry_year
      payment_method_type
      card_type
      last4
    }
  }
`;

export const SHOP_CREATE_CARD_PAYMENT_METHOD = gql`
  mutation CreateCardPaymentMethod(
    $input: CreateAcceptBlueCardPaymentMethodInput!
  ) {
    createAcceptBlueCardPaymentMethod(input: $input) {
      id
      created_at
      avs_address
      avs_zip
      name
      expiry_month
      expiry_year
      payment_method_type
      card_type
      last4
    }
  }
`;

export const SHOP_CREATE_CHECK_PAYMENT_METHOD = gql`
  mutation CreateCheckPaymentMethod(
    $input: CreateAcceptBlueCheckPaymentMethodInput!
  ) {
    createAcceptBlueCheckPaymentMethod(input: $input) {
      id
      created_at
      name
      payment_method_type
      account_type
      routing_number
      sec_code
      last4
    }
  }
`;

export const ADMIN_CREATE_CHECK_PAYMENT_METHOD = gql`
  mutation CreateCheckPaymentMethod(
    $input: CreateAcceptBlueCheckPaymentMethodInput!
    $customerId: Int!
  ) {
    createAcceptBlueCheckPaymentMethod(input: $input, customerId: $customerId) {
      id
      created_at
      name
      payment_method_type
      account_type
      routing_number
      sec_code
      last4
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
        state
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
            acceptBlueSubscriptionIds
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

export const REFUND_TRANSACTION = gql`
  mutation RefundAcceptBlueTransaction(
    $transactionId: Int!
    $amount: Int
    $cvv2: String
  ) {
    refundAcceptBlueTransaction(
      transactionId: $transactionId
      amount: $amount
      cvv2: $cvv2
    ) {
      referenceNumber
      version
      status
      errorMessage
      errorCode
      errorDetails
    }
  }
`;

export const GET_ORDER_BY_CODE = gql`
  query GetOrderByCode($code: String!) {
    orderByCode(code: $code) {
      id
      code
      lines {
        acceptBlueSubscriptions {
          name
          variantId
          amountDueNow
          priceIncludesTax
          recurring {
            amount
            interval
            intervalCount
            createdAt
            startDate
            nextRunDate
            previousRunDate
            numLeft
          }
          transactions {
            id
            createdAt
            settledAt
            amount
            status
            errorCode
            errorMessage
            checkDetails {
              name
              routingNumber
              last4
            }
            cardDetails {
              name
              last4
              expiryMonth
              expiryYear
            }
          }
        }
      }
    }
  }
`;

export const GET_HISTORY_ENTRIES = gql`
  query GetHistoryEntries($id: ID!) {
    order(id: $id) {
      id
      code
      history {
        items {
          id
          type
          data
        }
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

export const UPDATE_SUBSCRIPTION = gql`
  mutation UpdateSubscription($input: UpdateAcceptBlueSubscriptionInput!) {
    updateAcceptBlueSubscription(input: $input) {
      id
      name
      variantId
      amountDueNow
      priceIncludesTax
      paymentMethodId
      recurring {
        amount
        interval
        intervalCount
        createdAt
        startDate
        nextRunDate
        previousRunDate
        numLeft
      }
    }
  }
`;

export const ELIGIBLE_AC_PAYMENT_METHODS = gql`
  query eligibleAcceptBluePaymentMethods {
    eligibleAcceptBluePaymentMethods {
      name
      tokenizationKey
      googlePayMerchantId
      googlePayGatewayMerchantId
    }
  }
`;

export const ELIGIBLE_PAYMENT_METHODS = gql`
  query eligiblePaymentMethods {
    eligiblePaymentMethods {
      id
      name
      acceptBlueHostedTokenizationKey
      acceptBlueGooglePayMerchantId
      acceptBlueGooglePayGatewayMerchantId
    }
  }
`;

export const GET_SURCHARGES = gql`
  query {
    acceptBlueSurcharges {
      card {
        type
        value
      }
      check {
        type
        value
      }
    }
  }
`;

export const UPDATE_CARD_PAYMENT_METHOD = gql`
  mutation UpdateCardPaymentMethod(
    $input: UpdateAcceptBlueCardPaymentMethodInput!
  ) {
    updateAcceptBlueCardPaymentMethod(input: $input) {
      id
      avs_address
      avs_zip
      name
      expiry_month
      expiry_year
    }
  }
`;

export const UPDATE_CHECK_PAYMENT_METHOD = gql`
  mutation UpdateCheckPaymentMethod(
    $input: UpdateAcceptBlueCheckPaymentMethodInput!
  ) {
    updateAcceptBlueCheckPaymentMethod(input: $input) {
      id
      name
      routing_number
      account_type
      sec_code
    }
  }
`;

export const DELETE_PAYMENT_METHOD = gql`
  mutation DeletePaymentMethod($id: Int!) {
    deleteAcceptBluePaymentMethod(id: $id)
  }
`;
