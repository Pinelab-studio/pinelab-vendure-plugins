import gql from 'graphql-tag';

export const updateMyparcelConfig = gql`
  mutation updateMyparcelConfig($input: MyparcelConfigInput!) {
    updateMyparcelConfig(input: $input) {
      apiKey
    }
  }
`;

export const getMyparcelConfig = gql`
  query myparcelConfig {
    myparcelConfig {
      apiKey
    }
  }
`;
