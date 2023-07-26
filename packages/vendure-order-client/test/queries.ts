import { gql } from 'graphql-tag';

const PROMOTION_FRAGMENT = `
    fragment PromotionFields on Promotion{
        id
        couponCode
    }
`;
export const CREATE_PROMOTION = gql`
  ${PROMOTION_FRAGMENT}
  mutation CreatePromotionMutation($input: CreatePromotionInput!) {
    createPromotion(input: $input) {
      ... on Promotion {
        ...PromotionFields
      }
    }
  }
`;
