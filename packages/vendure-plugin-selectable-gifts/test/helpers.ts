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
              name: 'amountOfGiftsAllowed',
              value: '1',
            },
            {
              name: 'facets',
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
