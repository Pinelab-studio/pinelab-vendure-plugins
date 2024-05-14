import gql from 'graphql-tag';

export const updateShipmateConfig = gql`
  mutation updateShipmateConfig($input: ShipmateConfigInput!) {
    updateShipmateConfig(input: $input) {
      apiKey
    }
  }
`;

export const getShipmateConfig = gql`
  query getShipmateConfig {
    shipmateConfig {
      apiKey
    }
  }
`;
