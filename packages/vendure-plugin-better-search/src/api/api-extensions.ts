import gql from 'graphql-tag';

export const shopApiExtensions = gql`
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
