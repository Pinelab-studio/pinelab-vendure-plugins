import { SimpleGraphQLClient } from '@vendure/testing';
import gql from 'graphql-tag';

export async function updateSendCloudConfig(
  adminClient: SimpleGraphQLClient,
  secret: string,
  publicKey: string
) {
  const { updateSendCloudConfig } = await adminClient.query(gql`
      mutation updateSendCloudConfig {
          updateSendCloudConfig(input:{secret:"${secret}", publicKey: "${publicKey}"}) {
              id
              secret
              publicKey
          }
      }`);
  return updateSendCloudConfig;
}
