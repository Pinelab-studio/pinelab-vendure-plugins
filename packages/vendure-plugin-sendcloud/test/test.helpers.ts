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

export const GET_ORDER_NOTES = gql`
  query OrderNotes($id: ID!) {
    order(id: $id) {
      history(options: { filter: { type: { eq: "ORDER_NOTE" } } }) {
        items {
          id
          data
        }
      }
    }
  }
`;

/**
 * Get the note that is added to an order after it has been synced to SendCloud
 */
export async function getSyncSuccessNote(
  adminClient: SimpleGraphQLClient,
  orderId: string
): Promise<{ id: string; data: { note: string } } | undefined> {
  const { order } = await adminClient.query(GET_ORDER_NOTES, { id: orderId });
  return order?.history.items.find(
    (entry: { data: { note?: string } }) =>
      entry.data.note === 'Successfully synced to SendCloud'
  );
}

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
