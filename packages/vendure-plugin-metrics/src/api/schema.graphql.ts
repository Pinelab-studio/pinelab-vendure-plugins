import gql from 'graphql-tag';

export const schema = gql`
  type MetricSummary {
    interval: MetricInterval!
    code: String!
    title: String!
    entries: [MetricSummaryEntry!]!
  }
  enum MetricInterval {
    WEEKLY
    MONTHLY
  }
  type MetricSummaryEntry {
    label: String!
    value: Float!
  }
  input MetricSummaryInput {
    interval: MetricInterval!
  }
  extend type Query {
    """
    Get metrics from X weeks/months ago to now.
    Preceding 26 weeks for WEEKLY and the preceding 12 months when given a MONTHLY interval
    """
    metricSummary(input: MetricSummaryInput): [MetricSummary!]!
  }
`;
