import gql from 'graphql-tag';

// FIXME, incomplete
export const GET_METRICS = gql`
  query advancedMetricSummaries($input: AdvancedMetricSummaryInput!) {
    advancedMetricSummaries(input: $input) {
      code
  }
`;
