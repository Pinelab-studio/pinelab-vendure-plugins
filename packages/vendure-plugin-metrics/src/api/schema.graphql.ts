import gql from 'graphql-tag';

export const schema = gql`
  type AdvancedMetricSummary {
    code: String!
    title: String!
    type: AdvancedMetricType!
    # The number of labels always matches the number of values.
    # E.g [january, february, march] belong to values [10, 20, 30]
    labels: [String!]!
    series: [AdvancedMetricSeries!]!
  }

  enum AdvancedMetricType {
    currency
    number
  }

  type AdvancedMetricSeries {
    name: String!
    values: [Float!]!
  }

  input AdvancedMetricSummaryInput {
    variantIds: [ID!]
  }

  extend type Query {
    advancedMetricSummaries(
      input: AdvancedMetricSummaryInput
    ): [AdvancedMetricSummary!]!
  }
`;
