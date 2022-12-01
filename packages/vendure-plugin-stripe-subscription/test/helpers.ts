import gql from 'graphql-tag';
import { SimpleGraphQLClient } from '@vendure/testing';

export const ADD_ITEM_TO_ORDER = gql`
  mutation AddItemToOrder($productVariantId: ID!, $quantity: Int!) {
    addItemToOrder(productVariantId: $productVariantId, quantity: $quantity) {
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

export const CREATE_PAYMENT_METHOD = gql`
  mutation CreatePaymentMethod($input: CreatePaymentMethodInput!) {
    createPaymentMethod(input: $input) {
      id
    }
  }
`;

export const SET_SHIPPING_ADDRESS = gql`
  mutation SetShippingAddress($input: CreateAddressInput!) {
    setOrderShippingAddress(input: $input) {
      ... on Order {
        shippingAddress {
          fullName
          company
          streetLine1
          streetLine2
          city
          province
          postalCode
          country
          phoneNumber
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
  mutation SetShippingMethod($id: ID!) {
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

export const CREATE_PAYMENT_LINK = gql`
  mutation createStripeSubscriptionPaymentLink($code: String!) {
    createStripeSubscriptionPaymentLink(paymentMethodCode: $code)
  }
`;

export async function setShipping(
  shopClient: SimpleGraphQLClient
): Promise<void> {
  await shopClient.query(SET_SHIPPING_ADDRESS, {
    input: {
      fullName: 'name',
      streetLine1: '12 the street',
      city: 'Leeuwarden',
      postalCode: '123456',
      countryCode: 'AT',
    },
  });
  await shopClient.query(SET_SHIPPING_METHOD, {
    id: 1,
  });
}
