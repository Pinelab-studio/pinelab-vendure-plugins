import { GraphQLClient, gql } from 'graphql-request';

export class GraphqlQueries {
  constructor(private ADDITIONAL_ORDER_FIELDS: string) {
    // if (additionalOrderFields) {
    //   this.ADDITIONAL_ORDER_FIELDS = additionalOrderFields;
    // }
  }

  ACTIVE_ORDER_FIELDS = gql`
    ${this.ADDITIONAL_ORDER_FIELDS}
    fragment ActiveOrderFields on Order {
      ...AdditionalOrderFields
      id
      code
      state
      active
      totalWithTax
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
      }
      discounts {
        description
        amountWithTax
      }
      couponCodes
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
    mutation ApplyCounpnCodeMutation($couponCode: String!) {
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
    mutation SetOrderShippingMethod($shippingMethodId: ID!) {
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
}
