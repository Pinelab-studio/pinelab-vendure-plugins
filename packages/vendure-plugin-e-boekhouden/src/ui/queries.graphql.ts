import gql from 'graphql-tag';

export const updateEBoekhoudenConfigMutation = gql`
  mutation updateEBoekhoudenConfig($input: EBoekhoudenConfigInput!) {
    updateEBoekhoudenConfig(input: $input) {
      enabled
      username
      secret1
      secret2
      account
      contraAccount
    }
  }
`;

export const eBoekhoudenConfigQuery = gql`
  query eBoekhoudenConfig {
    eBoekhoudenConfig {
      enabled
      username
      secret1
      secret2
      account
      contraAccount
    }
  }
`;
