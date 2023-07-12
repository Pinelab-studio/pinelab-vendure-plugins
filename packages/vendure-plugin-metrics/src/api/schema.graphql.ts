import gql from 'graphql-tag';

export const schema = gql`
  type AdvancedMetricSummary {
    interval: AdvancedMetricInterval!
    code: String!
    title: String!
    type: AdvancedMetricType!
    entries: [AdvancedMetricSummaryEntry!]!
  }

  enum AdvancedMetricType {
    currency
    number
  }

  enum AdvancedMetricInterval {
    WEEKLY
    MONTHLY
  }
  type AdvancedMetricSummaryEntry {
    label: String!
    value: Float!
  }
  input AdvancedMetricSummaryInput {
    interval: AdvancedMetricInterval!
    variantIds: [ID!]
  }
  extend type Query {
    """
    Get metrics from X weeks/months ago to now.
    Preceding 26 weeks for WEEKLY and the preceding 12 months when given a MONTHLY interval
    """
    advancedMetricSummary(
      input: AdvancedMetricSummaryInput
    ): [AdvancedMetricSummary!]!
  }
`;
