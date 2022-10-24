import gql from 'graphql-tag';

export const GET_METRICS = gql`
  query metricList($input: MetricListInput!) {
    metricList(input: $input) {
      id
      startDate
      endDate
      interval
      metrics {
        id
        title
        data {
          label
          value
        }
      }
    }
  }
`;
