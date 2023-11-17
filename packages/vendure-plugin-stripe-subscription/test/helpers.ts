import { gql } from 'graphql-tag';
import { SimpleGraphQLClient } from '@vendure/testing';
import { ChannelService, RequestContext } from '@vendure/core';
import { TestServer } from '@vendure/testing/lib/test-server';

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

export const GET_ACTIVE_ORDER = gql`
  query activeOrder {
    activeOrder {
      id
      code
      totalWithTax
      total
      lines {
        id
        stripeSubscriptions {
          name
          amountDueNow
          variantId
          priceIncludesTax
          recurring {
            amount
            interval
            intervalCount
            startDate
            endDate
          }
        }
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

export const GET_PAYMENT_METHODS = gql`
  query paymentMethods {
    paymentMethods {
      items {
        code
        handler {
          args {
            name
            value
            __typename
          }
        }
      }
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

export const CREATE_PAYMENT_LINK = gql`
  mutation createStripeSubscriptionIntent {
    createStripeSubscriptionIntent {
      clientSecret
      intentType
    }
  }
`;

export const ELIGIBLE_PAYMENT_METHODS = gql`
  query eligiblePaymentMethods {
    eligiblePaymentMethods {
      id
      name
      stripeSubscriptionPublishableKey
    }
  }
`;

export const PREVIEW_SUBSCRIPTIONS = gql`
  query previewStripeSubscriptions($productVariantId: ID!) {
    previewStripeSubscriptions(productVariantId: $productVariantId) {
      name
      amountDueNow
      variantId
      priceIncludesTax
      recurring {
        amount
        interval
        intervalCount
        startDate
        endDate
      }
    }
  }
`;

export const PREVIEW_SUBSCRIPTIONS_FOR_PRODUCT = gql`
  query previewStripeSubscriptionsForProduct($productId: ID!) {
    previewStripeSubscriptionsForProduct(productId: $productId) {
      name
      amountDueNow
      variantId
      priceIncludesTax
      recurring {
        amount
        interval
        intervalCount
        startDate
        endDate
      }
    }
  }
`;

export const CANCEL_ORDER = gql`
  mutation CancelOrder($input: CancelOrderInput!) {
    cancelOrder(input: $input) {
      __typename
    }
  }
`;

export const REFUND_ORDER = gql`
  mutation RefundOrder($input: RefundOrderInput!) {
    refundOrder(input: $input) {
      __typename
    }
  }
`;

export function getOneMonthFromNow() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), 12);
}

export async function setShipping(
  shopClient: SimpleGraphQLClient
): Promise<void> {
  //@ts-ignore
  await shopClient.query(SET_SHIPPING_ADDRESS, {
    input: {
      fullName: 'name',
      streetLine1: '12 the street',
      city: 'Leeuwarden',
      postalCode: '123456',
      countryCode: 'AT',
    },
  });
  //@ts-ignore
  await shopClient.query(SET_SHIPPING_METHOD, {
    id: [1],
  });
}

export async function getDefaultCtx(server: TestServer) {
  const channel = await server.app.get(ChannelService).getDefaultChannel();
  return new RequestContext({
    apiType: 'admin',
    isAuthorized: true,
    authorizedAsOwnerOnly: false,
    channel,
  });
}
