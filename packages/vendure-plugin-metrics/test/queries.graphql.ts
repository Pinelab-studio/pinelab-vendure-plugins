import gql from 'graphql-tag';

export const GET_METRIC_CHARTS = gql`
  query metricCharts($code: String!) {
    metricCharts(code: $code) {
      code
      variation
      title
      type
      data
      options
      valueFormat
      updatedAt
    }
  }
`;

export const GET_METRIC_CODE_ENUM = gql`
  query metricCodeEnum {
    __type(name: "MetricCode") {
      enumValues {
        name
      }
    }
  }
`;
