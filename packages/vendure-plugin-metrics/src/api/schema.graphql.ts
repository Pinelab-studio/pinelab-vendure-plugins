import gql from 'graphql-tag';

export const schema = gql`
  type PinelabMetricSummary {
    interval: PinelabMetricInterval!
    code: String!
    title: String!
    entries: [PinelabMetricSummaryEntry!]!
  }
  enum PinelabMetricInterval {
    WEEKLY
    MONTHLY
  }
  type PinelabMetricSummaryEntry {
    label: String!
    value: Float!
  }
  input PinelabMetricSummaryInput {
    interval: PinelabMetricInterval!
    variantIds: [ID!]
  }
  extend type Query {
    """
    Get metrics from X weeks/months ago to now.
    Preceding 26 weeks for WEEKLY and the preceding 12 months when given a MONTHLY interval
    """
    pinelabMetricSummary(
      input: PinelabMetricSummaryInput
    ): [PinelabMetricSummary!]!
  }
`;
