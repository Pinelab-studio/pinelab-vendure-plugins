import gql from 'graphql-tag';

export const GET_METRICS = gql`
  query metricList($input: MetricListInput!) {
    metricList(input: $input) {
      id
      interval
      metrics {
        code
        title
        entries {
          label
          value
        }
      }
    }
  }
`;
