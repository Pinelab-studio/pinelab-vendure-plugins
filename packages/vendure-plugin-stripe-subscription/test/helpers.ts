import { gql } from 'graphql-tag';
import { SimpleGraphQLClient } from '@vendure/testing';
import { SCHEDULE_FRAGMENT } from '../src/ui/queries';
import { ChannelService, RequestContext } from '@vendure/core';
import { TestServer } from '@vendure/testing/lib/test-server';

export const ADD_ITEM_TO_ORDER = gql`
  mutation AddItemToOrder(
    $productVariantId: ID!
    $quantity: Int!
    $customFields: OrderLineCustomFieldsInput
  ) {
    addItemToOrder(
      productVariantId: $productVariantId
      quantity: $quantity
      customFields: $customFields
    ) {
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

export const REMOVE_ORDERLINE = gql`
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

export const REMOVE_ALL_ORDERLINES = gql`
  mutation {
    removeAllOrderLines {
      ... on Order {
        id
      }
    }
  }
`;

export const UPDATE_CHANNEL = gql`
  mutation UpdateChannel($input: UpdateChannelInput!) {
    updateChannel(input: $input) {
      ... on Channel {
        id
      }
    }
  }
`;

export const GET_PRICING = gql`
  ${SCHEDULE_FRAGMENT}
  query stripeSubscriptionPricing($input: StripeSubscriptionPricingInput) {
    stripeSubscriptionPricing(input: $input) {
      downpayment
      totalProratedAmount
      proratedDays
      dayRate
      recurringPrice
      interval
      intervalCount
      amountDueNow
      subscriptionStartDate
      schedule {
        ...ScheduleFields
      }
    }
  }
`;

export const GET_PRICING_FOR_PRODUCT = gql`
  ${SCHEDULE_FRAGMENT}
  query stripeSubscriptionPricingForProduct($productId: ID!) {
    stripeSubscriptionPricingForProduct(productId: $productId) {
      downpayment
      totalProratedAmount
      proratedDays
      dayRate
      recurringPrice
      interval
      intervalCount
      amountDueNow
      subscriptionStartDate
      schedule {
        ...ScheduleFields
      }
    }
  }
`;

export const GET_ORDER_WITH_PRICING = gql`
  ${SCHEDULE_FRAGMENT}
  query getOrderWithPricing {
    activeOrder {
      id
      code
      lines {
        subscriptionPricing {
          downpayment
          totalProratedAmount
          proratedDays
          dayRate
          recurringPrice
          originalRecurringPrice
          interval
          intervalCount
          amountDueNow
          subscriptionStartDate
          schedule {
            ...ScheduleFields
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
    createStripeSubscriptionIntent
  }
`;

export const GET_SCHEDULES = gql`
  {
    stripeSubscriptionSchedules {
      items {
        id
        createdAt
        updatedAt
        name
        downpayment
        durationInterval
        durationCount
        startMoment
        paidUpFront
        billingInterval
        billingCount
      }
    }
  }
`;

export const UPDATE_VARIANT = gql`
  mutation updateProductVariants($input: [UpdateProductVariantInput!]!) {
    updateProductVariants(input: $input) {
      ... on ProductVariant {
        id
        customFields {
          subscriptionSchedule {
            id
          }
        }
      }
      __typename
    }
  }
`;

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
