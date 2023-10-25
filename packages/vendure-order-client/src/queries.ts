import { gql } from 'graphql-request';

// Default fragment is always needed for codegen
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const dummyFragment = gql`
  fragment AdditionalOrderFields on Order {
    id
  }
`;

export class GraphqlQueries {
  constructor(private readonly ADDITIONAL_ORDER_FIELDS: string) {}

  ACTIVE_ORDER_FIELDS = gql`
    ${this.ADDITIONAL_ORDER_FIELDS}
    fragment ActiveOrderFields on Order {
      ...AdditionalOrderFields
      id
      code
      state
      active
      total
      totalWithTax
      subTotal
      subTotalWithTax
      shippingWithTax
      totalQuantity
      customer {
        id
        firstName
        lastName
        phoneNumber
        emailAddress
      }
      shippingAddress {
        fullName
        company
        streetLine1
        streetLine2
        city
        postalCode
        country
        countryCode
      }
      billingAddress {
        fullName
        company
        streetLine1
        streetLine2
        city
        postalCode
        country
        countryCode
      }
      shipping
      shippingWithTax
      shippingLines {
        shippingMethod {
          id
          code
          name
        }
        priceWithTax
      }
      lines {
        id
        quantity
        linePriceWithTax
        featuredAsset {
          id
          preview
        }
        productVariant {
          id
          sku
          name
          priceWithTax
          product {
            id
            name
            slug
          }
        }
      }
      taxSummary {
        taxRate
        taxTotal
        taxBase
      }
      payments {
        id
        state
        errorMessage
        metadata
        method
      }
      discounts {
        description
        amountWithTax
      }
      couponCodes
    }
  `;

  CURRENT_USER_FIELDS = gql`
    fragment CurrentUserFields on CurrentUser {
      id
      identifier
      channels {
        code
        token
        permissions
      }
    }
  `;

  ADD_ITEM_TO_ORDER = gql`
    ${this.ACTIVE_ORDER_FIELDS}
    mutation additemToOrder($productVariantId: ID!, $quantity: Int!) {
      addItemToOrder(productVariantId: $productVariantId, quantity: $quantity) {
        ... on Order {
          ...ActiveOrderFields
        }
        ... on ErrorResult {
          errorCode
          message
        }
      }
    }
  `;

  ADJUST_ORDERLINE = gql`
    ${this.ACTIVE_ORDER_FIELDS}
    mutation adjustOrderLine($orderLineId: ID!, $quantity: Int!) {
      adjustOrderLine(orderLineId: $orderLineId, quantity: $quantity) {
        ... on Order {
          ...ActiveOrderFields
        }
        ... on ErrorResult {
          errorCode
          message
        }
      }
    }
  `;

  REMOVE_ALL_ORDERLINES = gql`
    ${this.ACTIVE_ORDER_FIELDS}
    mutation removeAllOrderLines {
      removeAllOrderLines {
        ... on Order {
          ...ActiveOrderFields
        }
        ... on ErrorResult {
          errorCode
          message
        }
      }
    }
  `;

  GET_ACTIVE_ORDER = gql`
    ${this.ACTIVE_ORDER_FIELDS}
    query activeOrder {
      activeOrder {
        ...ActiveOrderFields
      }
    }
  `;

  APPLY_COUPON_CODE = gql`
    ${this.ACTIVE_ORDER_FIELDS}
    mutation ApplyCouponCode($couponCode: String!) {
      applyCouponCode(couponCode: $couponCode) {
        ... on Order {
          ...ActiveOrderFields
        }
        ... on ErrorResult {
          errorCode
          message
        }
      }
    }
  `;

  REMOVE_COUPON_CODE = gql`
    ${this.ACTIVE_ORDER_FIELDS}
    mutation RemoveCouponCode($couponCode: String!) {
      removeCouponCode(couponCode: $couponCode) {
        ...ActiveOrderFields
      }
    }
  `;

  SET_CUSTOMER_FOR_ORDER = gql`
    ${this.ACTIVE_ORDER_FIELDS}
    mutation SetCustomerForOrder($input: CreateCustomerInput!) {
      setCustomerForOrder(input: $input) {
        ... on Order {
          ...ActiveOrderFields
        }
        ... on ErrorResult {
          errorCode
          message
        }
      }
    }
  `;

  SET_ORDER_SHIPPING_ADDRESS = gql`
    ${this.ACTIVE_ORDER_FIELDS}
    mutation SetOrderShippingAddress($input: CreateAddressInput!) {
      setOrderShippingAddress(input: $input) {
        ... on Order {
          ...ActiveOrderFields
        }
        ... on ErrorResult {
          errorCode
          message
        }
      }
    }
  `;

  SET_ORDER_BILLING_ADDRESS = gql`
    ${this.ACTIVE_ORDER_FIELDS}
    mutation SetOrderBillingAddress($input: CreateAddressInput!) {
      setOrderBillingAddress(input: $input) {
        ... on Order {
          ...ActiveOrderFields
        }
        ... on ErrorResult {
          errorCode
          message
        }
      }
    }
  `;

  SET_ORDER_SHIPPING_METHOD = gql`
    ${this.ACTIVE_ORDER_FIELDS}
    mutation SetOrderShippingMethod($shippingMethodId: [ID!]!) {
      setOrderShippingMethod(shippingMethodId: $shippingMethodId) {
        ... on Order {
          ...ActiveOrderFields
        }
        ... on ErrorResult {
          errorCode
          message
        }
      }
    }
  `;

  ADD_PAYMENT_TO_ORDER = gql`
    ${this.ACTIVE_ORDER_FIELDS}
    mutation AddPaymentToOrder($input: PaymentInput!) {
      addPaymentToOrder(input: $input) {
        ... on Order {
          ...ActiveOrderFields
        }
        ... on ErrorResult {
          errorCode
          message
        }
      }
    }
  `;

  TRANSITION_ORDER_TO_STATE = gql`
    ${this.ACTIVE_ORDER_FIELDS}
    mutation TransitionOrderToState($state: String!) {
      transitionOrderToState(state: $state) {
        ... on Order {
          ...ActiveOrderFields
        }
        ... on ErrorResult {
          errorCode
          message
        }
      }
    }
  `;

  GET_ORDER_BY_CODE = gql`
    ${this.ACTIVE_ORDER_FIELDS}
    query GetOrderByCode($code: String!) {
      orderByCode(code: $code) {
        ...ActiveOrderFields
      }
    }
  `;

  REGISTER_CUSTOMER_ACCOUNT = gql`
    mutation RegisterCustomerAccount($input: RegisterCustomerInput!) {
      registerCustomerAccount(input: $input) {
        ... on Success {
          success
        }
        ... on ErrorResult {
          errorCode
          message
        }
        ... on PasswordValidationError {
          validationErrorMessage
        }
      }
    }
  `;

  REQUEST_PASSWORD_RESET = gql`
    mutation RequestPasswordReset($emailAddress: String!) {
      requestPasswordReset(emailAddress: $emailAddress) {
        ... on Success {
          success
        }
        ... on ErrorResult {
          errorCode
          message
        }
      }
    }
  `;

  RESET_PASSWORD = gql`
    mutation ResetPassword($token: String!, $password: String!) {
      resetPassword(token: $token, password: $password) {
        ... on CurrentUser {
          ...CurrentUserFields
        }
        ... on ErrorResult {
          errorCode
          message
        }
        ... on PasswordValidationError {
          validationErrorMessage
        }
      }
    }
    ${this.CURRENT_USER_FIELDS}
  `;

  LOGIN = gql`
    mutation Login(
      $username: String!
      $password: String!
      $rememberMe: Boolean
    ) {
      login(username: $username, password: $password, rememberMe: $rememberMe) {
        ... on CurrentUser {
          ...CurrentUserFields
        }
        ... on ErrorResult {
          errorCode
          message
        }
      }
    }
    ${this.CURRENT_USER_FIELDS}
  `;

  GET_ELIGIBLE_SHIPPING_METHODS = gql`
    query GetEligibleShippingMethods {
      eligibleShippingMethods {
        id
        name
        price
        priceWithTax
        code
        description
        metadata
        customFields
      }
    }
  `;
}
