import gql from 'graphql-tag';

export const GET_METRICS = gql`
  query pinelabMetricSummary($input: PinelabMetricSummaryInput!) {
    pinelabMetricSummary(input: $input) {
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
