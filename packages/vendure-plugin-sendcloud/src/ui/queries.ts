import gql from 'graphql-tag';

export const UPDATE_SENDCLOUD_CONFIG = gql`
  mutation updateSendCloudConfig($input: SendCloudConfigInput) {
    updateSendCloudConfig(input: $input) {
      id
      secret
      publicKey
    }
  }
`;

export const GET_SENDCLOUD_CONFIG = gql`
  query sendCloudConfig {
    sendCloudConfig {
      id
      secret
      publicKey
    }
  }
`;
