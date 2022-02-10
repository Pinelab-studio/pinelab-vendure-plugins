import gql from 'graphql-tag';

export const getConfigs = gql`
  query allOrderExportConfigs {
    allOrderExportConfigs {
      name
      arguments {
        name
        value
      }
    }
  }
`;

export const saveConfig = gql`
  mutation updateOrderExportConfig($input: OrderExportConfigInput!) {
    updateOrderExportConfig(input: $input) {
      name
      arguments {
        name
        value
      }
    }
  }
`;
