import gql from 'graphql-tag';

export const GET_METRICS = gql`
  query advancedMetricSummaries($input: AdvancedMetricSummaryInput) {
    advancedMetricSummaries(input: $input) {
      code
      title
      type
      allowProductSelection
      labels
      series {
        name
        values
      }
    }
  }
`;
