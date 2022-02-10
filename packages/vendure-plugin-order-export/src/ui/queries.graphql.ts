import gql from 'graphql-tag';

export const getStrategies = gql`
  query allOrderExportStrategies {
    allOrderExportStrategies {
      name
      arguments {
        name
        value
      }
    }
  }
`;

export const saveStrategy = gql`
  mutation updateOrderExportStrategy($input: OrderExportStrategyInput!) {
    updateOrderExportStrategy(input: $input) {
      name
      arguments {
        name
        value
      }
    }
  }
`;
