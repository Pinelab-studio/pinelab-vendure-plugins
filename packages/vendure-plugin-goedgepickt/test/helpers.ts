import gql from 'graphql-tag';

export const updateChannel = gql`
  mutation UpdateChannel($input: UpdateChannelInput!) {
    updateChannel(input: $input) {
      ... on Channel {
        id
        token
        customFields {
          ggEnabled
          ggUuidApiKey
        }
      }
      __typename
    }
  }
`;
