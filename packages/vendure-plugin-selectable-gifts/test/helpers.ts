import { SimpleGraphQLClient } from '@vendure/testing';
import gql from 'graphql-tag';

export async function createPromotion(adminClient: SimpleGraphQLClient) {
  const input = {
    input: {
      name: 'Free gift for loyal customers',
      enabled: true,
      startsAt: null,
      endsAt: null,
      conditions: [
        {
          code: 'minimum_order_amount',
          arguments: [
            {
              name: 'amount',
              value: '100',
            },
            {
              name: 'taxInclusive',
              value: 'false',
            },
          ],
        },
      ],
      actions: [
        {
          code: 'free_gifts',
          arguments: [
            {
              name: 'variants',
              value: '["T_1"]',
            },
          ],
        },
      ],
    },
  };
  await adminClient.query(
    gql`
      mutation CreatePromotion($input: CreatePromotionInput!) {
        createPromotion(input: $input) {
          ... on Promotion {
            id
            createdAt
            updatedAt
            name
            enabled
            couponCode
            perCustomerUsageLimit
            startsAt
            endsAt
          }
        }
      }
    `,
    input
  );
}

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
