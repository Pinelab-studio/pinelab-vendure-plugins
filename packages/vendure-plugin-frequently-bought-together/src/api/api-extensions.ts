import gql from 'graphql-tag';

export const adminApiExtensions = gql`
  type FrequentlyBoughtTogetherPreview {
    memoryUsed: String!
    totalItemSets: Int!
    bestItemSets: [FrequentlyBoughtTogetherItemSet!]!
    worstItemSets: [FrequentlyBoughtTogetherItemSet!]!
  }

  type FrequentlyBoughtTogetherItemSet {
    items: [String!]
    support: Float!
  }

  extend type Query {
    previewFrequentlyBoughtTogether(
      support: Float!
    ): FrequentlyBoughtTogetherPreview!
  }
`;
