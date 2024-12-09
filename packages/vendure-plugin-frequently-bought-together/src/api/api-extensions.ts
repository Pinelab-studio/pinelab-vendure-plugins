import gql from 'graphql-tag';

export const adminApiExtensions = gql`
  type FrequentlyBoughtTogetherPreview {
    totalItemSets: Int!
    bestItemSets: [FrequentlyBoughtTogetherItemSet!]!
    worstItemSets: [FrequentlyBoughtTogetherItemSet!]!
  }

  type FrequentlyBoughtTogetherItemSet {
    items: [String!]
    support: Int!
  }

  extend type Query {
    previewFrequentlyBoughtTogether(
      support: Float!
    ): FrequentlyBoughtTogetherPreview!
  }
`;
