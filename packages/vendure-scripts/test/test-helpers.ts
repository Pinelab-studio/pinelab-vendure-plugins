import { CurrencyCode, LanguageCode } from '@vendure/core';
import { CreateChannelInput } from '@vendure/common/lib/generated-types';
import { gql } from 'graphql-tag';

export const createChannelInput: CreateChannelInput = {
  code: 'test-1',
  defaultLanguageCode: LanguageCode.en,
  defaultShippingZoneId: 1,
  defaultTaxZoneId: 1,
  pricesIncludeTax: true,
  token: 'test-1-token',
  defaultCurrencyCode: CurrencyCode.USD,
};

export const CREATE_CHANNEL = gql`
  mutation CreateChannelQuery($input: CreateChannelInput!) {
    createChannel(input: $input) {
      ... on Channel {
        code
        id
      }
    }
  }
`;

export const getAllProductsInChannel = gql`
  query GetAllProductsInChannel {
    products {
      items {
        id
      }
    }
  }
`;
