import { SimpleGraphQLClient } from '@vendure/testing';
import gql from 'graphql-tag';

export const UPDATE_CHANNEL = gql`
  mutation UpdateChannel($input: UpdateChannelInput!) {
    updateChannel(input: $input) {
      ... on Channel {
        id
        token
        customFields {
          sendcloudSecret
          sendcloudPublicKey
          sendcloudDefaultPhoneNr
        }
      }
      __typename
    }
  }
`;

export async function updateSendCloudConfig(
  adminClient: SimpleGraphQLClient,
  channelId: string,
  secret: string,
  publicKey: string,
  defaultPhoneNr: string
): Promise<{
  sendcloudSecret: string;
  sendcloudPublicKey: string;
  sendcloudDefaultPhoneNr: string;
}> {
  const { updateChannel } = await adminClient.query(UPDATE_CHANNEL, {
    input: {
      id: channelId,
      customFields: {
        sendcloudSecret: secret,
        sendcloudPublicKey: publicKey,
        sendcloudDefaultPhoneNr: defaultPhoneNr,
      },
    },
  });
  return updateChannel.customFields;
}
