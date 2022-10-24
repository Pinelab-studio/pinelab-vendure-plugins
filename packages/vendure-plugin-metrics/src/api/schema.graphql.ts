import gql from 'graphql-tag';

export const schema = gql`
  enum MetricInterval {
    WEEKLY
    MONTHLY
  }
  type MetricList {
    id: ID!
    startDate: DateTime!
    endDate: DateTime!
    interval: MetricInterval!
    metrics: [Metric!]!
  }
  type Metric {
    id: ID!
    title: String!
    data: [MetricEntry!]!
  }
  type MetricEntry {
    label: String!
    value: Float!
  }
  input MetricListInput {
    endDate: DateTime!
    interval: MetricInterval!
  }

  extend type Query {
    """
    Get metrics from given date with the preceding 12 entries:
    Preceding 12 weeks for WEEKLY and the preceding 12 months when given a MONTHLY interval
    """
    metricList(input: MetricListInput): MetricList!
  }
`;
