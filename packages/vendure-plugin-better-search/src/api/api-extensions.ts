import gql from 'graphql-tag';
import { BetterSearchPlugin } from '../better-search.plugin';

export const shopApiExtensions = () => {
  // Map the custom fields to the graphql schema. E.g. "facetValueNames: [String!]!"
  const customFields = Object.entries(
    BetterSearchPlugin.options.indexableFields
  )
    // Only include fields that have a graphqlFieldType
    .filter(([, value]) => value.graphqlFieldType)
    .map(([key, value]) => {
      return `${key}: ${value.graphqlFieldType}`;
    })
    .join('\n');

  return gql`
  type BetterSearchResult {
    productId: ID!
    slug: String!
    productName: String!
    productAsset: BetterSearchResultAsset
    lowestPrice: Float!
    lowestPriceWithTax: Float!
    highestPrice: Float!
    highestPriceWithTax: Float!
    facetValueIds: [ID!]!
    collectionIds: [ID!]!
    collectionNames: [String!]!
    skus: [String!]!
    ${customFields}
  }

  type BetterSearchResultAsset {
    id: ID!
    preview: String!
  }

  type BetterSearchResultList {
    items: [BetterSearchResult!]!
    totalItems: Int!
  }

  input BetterSearchInput {
    term: String!
    skip: Int
    take: Int
  }

  extend type Query {
    betterSearch(input: BetterSearchInput!): BetterSearchResultList!
  }
`;
};
