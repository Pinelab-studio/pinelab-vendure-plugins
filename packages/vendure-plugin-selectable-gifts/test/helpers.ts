import { ProductVariant, Promotion } from '@pinelab/vendure-order-client/src';
import { SimpleGraphQLClient } from '@vendure/testing';
import { CreatePromotionInput } from '@vendure/common/lib/generated-types';
import { gql } from 'graphql-tag';

const orderFragment = gql`
  fragment OrderFields on Order {
    id
    code
    totalWithTax
    lines {
      id
      quantity
      linePriceWithTax
      discountedUnitPriceWithTax
      discountedLinePriceWithTax
      productVariant {
        id
        name
        sku
      }
      customFields {
        isSelectedAsGift
      }
    }
    discounts {
      amount
      amountWithTax
      description
    }
  }
`;

export const ADD_ITEM_TO_ORDER = gql`
  ${orderFragment}
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
        ...OrderFields
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;

export const ADD_GIFT_TO_ORDER = gql`
  ${orderFragment}
  mutation addSelectedGiftToOrder($productVariantId: ID!) {
    addSelectedGiftToOrder(productVariantId: $productVariantId) {
      ... on Order {
        ...OrderFields
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;

export const ELIGIBLE_GIFTS = gql`
  query eligibleGifts {
    eligibleGifts {
      id
      name
      sku
      priceWithTax
    }
  }
`;

/**
 * Create a promotion that allows for a free  gift for orders above a certain amount
 */
export async function createPromotion(
  adminClient: SimpleGraphQLClient,
  promotionName: string,
  variantsAsGifts: string[],
  conditions: CreatePromotionInput['conditions']
): Promise<Promotion> {
  const input = {
    input: {
      translations: [
        {
          languageCode: 'en',
          name: promotionName,
          description: '',
        },
      ],
      enabled: true,
      startsAt: null,
      endsAt: null,
      conditions,
      actions: [
        {
          code: 'selectable_gifts',
          arguments: [
            {
              name: 'variants',
              value: JSON.stringify(variantsAsGifts),
            },
          ],
        },
      ],
    },
  };
  const { createPromotion } = await adminClient.query(
    gql`
      mutation createPromotion($input: CreatePromotionInput!) {
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
  return createPromotion;
}

export async function getEligibleGifts(
  shopClient: SimpleGraphQLClient
): Promise<ProductVariant[]> {
  const { eligibleGifts } = await shopClient.query(ELIGIBLE_GIFTS);
  return eligibleGifts;
}
