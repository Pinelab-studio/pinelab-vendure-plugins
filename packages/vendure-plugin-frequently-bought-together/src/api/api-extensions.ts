import gql from 'graphql-tag';

export const adminApiExtensions = gql`
  type FrequentlyBoughtTogetherPreview {
    """
    The max memory used during the calculation.
    Make sure this doesn't exceed your worker's memory limit.
    process.memoryUsage().rss is used to calculate this.
    """
    maxMemoryUsedInMB: Int!
    """
    The total number of sets found.
    """
    totalItemSets: Int!
    """
    The number of unique products for which a related product was found
    """
    uniqueProducts: Int!
    """
    The item sets with the most support
    """
    bestItemSets: [FrequentlyBoughtTogetherItemSet!]!
    """
    The item sets with the worst support. If these make sense, the others probably do too.
    """
    worstItemSets: [FrequentlyBoughtTogetherItemSet!]!
  }

  """
  An item set with a support value.
  An item set is a combination of products which are frequently bought together, e.g. ['product-1', 'product-2', 'product-3']
  Support is the number of orders this combination was in
  """
  type FrequentlyBoughtTogetherItemSet {
    items: [String!]
    support: Int!
  }

  extend type Query {
    """
    Preview the frequently bought together item sets,
    to check what level of support is reasonable for your data set
    """
    previewFrequentlyBoughtTogether(
      support: Float!
    ): FrequentlyBoughtTogetherPreview!
  }

  extend type Mutation {
    """
    Trigger the job to calculate and set frequently bought together products.
    """
    triggerFrequentlyBoughtTogetherCalculation: Boolean!
  }
`;

export const shopApiExtensions = gql`
  extend type Product {
    frequentlyBoughtWith: [Product!]!
  }
`;
