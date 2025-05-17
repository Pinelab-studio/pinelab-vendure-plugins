import gql from 'graphql-tag';

// This is only used by codegen so it knows DateTime is a custom scalar
const scalars = gql`
  scalar DateTime
`;

export const adminSchema = gql`
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
`;

export const shopSchema = gql`
  input pageVisitInput {
    path: String
    productId: ID
    productVariantId: ID
  }

  extend type Mutation {
    pageVisit(input: pageVisitInput): Boolean
  }
`;
