import { DocumentNode, parse } from 'graphql';
import gql from 'graphql-tag';

// This is only used by codegen so it knows these are custom scalars
const _scalars = gql`
  scalar DateTime
  scalar JSON
`;

export const adminApiExtensions = gql`
  enum MetricValueFormat {
    currency
    number
  }

  type MetricChart {
    code: String!
    """
    Null when the metric has no variations
    """
    variation: String
    title: String!
    """
    Chart.js chart type, like 'line' or 'bar'
    """
    type: String!
    """
    Chart.js data object
    """
    data: JSON!
    """
    Chart.js options object
    """
    options: JSON
    valueFormat: MetricValueFormat!
    updatedAt: DateTime!
  }

  extend type Query {
    """
    The stored charts of a metric, one per variation. Never calculates metrics live.
    """
    metricCharts(code: String!): [MetricChart!]!
  }
`;

/**
 * Creates the `MetricCode` enum with the codes of the configured metrics.
 * The React dashboard reads this enum from the schema at build time to register a widget per metric.
 */
export function createMetricCodeEnum(codes: string[]): DocumentNode {
  return parse(`enum MetricCode {\n${codes.join('\n')}\n}`);
}
