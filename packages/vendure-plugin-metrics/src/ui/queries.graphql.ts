import gql from 'graphql-tag';

export const GET_METRICS = gql`
  query advancedMetricSummary($input: AdvancedMetricSummaryInput!) {
    advancedMetricSummary(input: $input) {
      interval
      code
      title
      entries {
        label
        value
      }
      type
    }
  }
`;
