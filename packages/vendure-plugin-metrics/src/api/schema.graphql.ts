import gql from 'graphql-tag';

export const schema = gql`
  enum MetricInterval {
    WEEKLY
    MONTHLY
  }
  type MetricList {
    id: ID!
    interval: MetricInterval!
    metrics: [Metric!]!
  }
  type Metric {
    code: String!
    title: String!
    entries: [MetricEntry!]!
  }
  type MetricEntry {
    label: String!
    value: Float!
  }
  input MetricListInput {
    interval: MetricInterval!
  }
  extend type Query {
    """
    Get metrics untill now with the preceding 123 entries
    Preceding 12 weeks for WEEKLY and the preceding 12 months when given a MONTHLY interval
    """
    metricList(input: MetricListInput): MetricList!
  }
`;
