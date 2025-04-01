import gql from 'graphql-tag';

// This is only used by codegen so it knows DateTime is a custom scalar
const scalars = gql`
  scalar DateTime
`;

export const schema = gql`
  type AdvancedMetricSummary {
    code: String!
    title: String!
    type: AdvancedMetricType!
    allowProductSelection: Boolean!
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

  extend type Mutation {
    """
    Empty mutation to log browser visits.
    You can call this mutation on page load to track vitits.
    Returns null
    """
    pageVisit: Boolean
  }
`;
