import { SimpleGraphQLClient } from '@vendure/testing';
import gql from 'graphql-tag';
import { UPDATE_SENDCLOUD_CONFIG } from '../src/ui/queries';

export async function updateSendCloudConfig(
  adminClient: SimpleGraphQLClient,
  secret: string,
  publicKey: string
) {
  const { updateSendCloudConfig } = await adminClient.query(
    UPDATE_SENDCLOUD_CONFIG,
    {
      input: { secret, publicKey },
    }
  );
  return updateSendCloudConfig;
}
