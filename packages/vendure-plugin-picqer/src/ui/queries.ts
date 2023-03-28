import { gql } from 'graphql-tag';

export const CONFIG_FRAGMENT = gql`
  fragment ConfigFragment on PicqerConfig {
    enabled
    apiKey
    apiEndpoint
    storefrontUrl
    supportEmail
  }
`;

export const UPSERT_CONFIG = gql`
  ${CONFIG_FRAGMENT}
  mutation upsertPicqerConfig($input: PicqerConfigInput!) {
    upsertPicqerConfig(input: $input) {
      ...ConfigFragment
    }
  }
`;

export const TEST = gql`
  query isPicqerConfigValid($input: TestPicqerInput!) {
    isPicqerConfigValid(input: $input)
  }
`;

export const GET_CONFIG = gql`
  ${CONFIG_FRAGMENT}
  query picqerConfig {
    picqerConfig {
      ...ConfigFragment
    }
  }
`;
