import { SimpleGraphQLClient } from '@vendure/testing';
import {
  GET_SENDCLOUD_CONFIG,
  UPDATE_SENDCLOUD_CONFIG,
} from '../src/ui/queries';
import { SendcloudConfigEntity } from '../src/api/sendcloud-config.entity';

export async function updateSendCloudConfig(
  adminClient: SimpleGraphQLClient,
  secret: string,
  publicKey: string,
  defaultPhoneNr: string
): Promise<SendcloudConfigEntity> {
  const { updateSendCloudConfig } = await adminClient.query(
    UPDATE_SENDCLOUD_CONFIG,
    {
      input: { secret, publicKey, defaultPhoneNr },
    }
  );
  return updateSendCloudConfig;
}

export async function getSendCloudConfig(
  adminClient: SimpleGraphQLClient
): Promise<SendcloudConfigEntity> {
  const { sendCloudConfig } = await adminClient.query(GET_SENDCLOUD_CONFIG);
  return sendCloudConfig;
}
