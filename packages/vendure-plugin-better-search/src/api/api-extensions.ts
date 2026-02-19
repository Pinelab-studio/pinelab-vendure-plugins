import gql from 'graphql-tag';

export const shopApiExtensions = gql`
  type BetterSearchResult {
    productId: ID!
    slug: String!
    productName: String!
    lowestPrice: Float!
    lowestPriceWithTax: Float!
    highestPrice: Float!
    highestPriceWithTax: Float!
    facetValueIds: [ID!]!
    collectionIds: [ID!]!
    collectionNames: [String!]!
    skus: [String!]!
  }

  extend type Query {
    betterSearch(term: String!): [BetterSearchResult!]!
  }
`;
