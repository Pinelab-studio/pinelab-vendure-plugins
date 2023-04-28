import gql from 'graphql-tag';

export const GET_METRICS = gql`
  query metricSummary($input: MetricSummaryInput!) {
    metricSummary(input: $input) {
      interval
      code
      title
      entries {
        label
        value
      }
    }
  }
`;
