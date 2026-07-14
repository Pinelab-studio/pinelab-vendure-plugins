import { Injectable } from '@nestjs/common';
import { Channel, RequestContext, TransactionalConnection } from '@vendure/core';

export interface ShipmateChannelConfig {
  channelId: string;
  apiKey: string;
  username: string;
  password: string;
  webhookAuthTokens: string[];
}

@Injectable()
export class ShipmateConfigService {
  constructor(private connection: TransactionalConnection) {}

  /**
   * Get the Shipmate config for the current channel from its custom fields.
   * Returns null when apiKey, username or password is missing for the channel.
   */
  async getConfig(ctx: RequestContext): Promise<ShipmateChannelConfig | null> {
    const { shipmateApiKey, shipmateUsername, shipmatePassword, shipmateWebhookAuthTokens } =
      ctx.channel.customFields;
    if (!shipmateApiKey || !shipmateUsername || !shipmatePassword) {
      return null;
    }
    return {
      channelId: String(ctx.channelId),
      apiKey: shipmateApiKey,
      username: shipmateUsername,
      password: shipmatePassword,
      webhookAuthTokens: shipmateWebhookAuthTokens ?? [],
    };
  }

  /**
   * Reverse-lookup used by incoming webhooks: find the channel whose
   * Shipmate webhook auth tokens include the given token.
   */
  async getConfigWithWebhookAuthToken(
    webhookAuthToken: string
  ): Promise<ShipmateChannelConfig | null> {
    const channels = await this.connection.rawConnection
      .getRepository(Channel)
      .find();
    const channel = channels.find((c) =>
      (c.customFields.shipmateWebhookAuthTokens ?? []).includes(
        webhookAuthToken
      )
    );
    if (
      !channel ||
      !channel.customFields.shipmateApiKey ||
      !channel.customFields.shipmateUsername ||
      !channel.customFields.shipmatePassword
    ) {
      return null;
    }
    return {
      channelId: String(channel.id),
      apiKey: channel.customFields.shipmateApiKey,
      username: channel.customFields.shipmateUsername,
      password: channel.customFields.shipmatePassword,
      webhookAuthTokens: channel.customFields.shipmateWebhookAuthTokens ?? [],
    };
  }
}
