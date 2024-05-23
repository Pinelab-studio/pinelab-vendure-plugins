import { Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection } from '@vendure/core';
import { ShipmateConfigEntity } from './shipmate-config.entity';

@Injectable()
export class ShipmateConfigService {
  constructor(private connection: TransactionalConnection) {}
  async getConfig(ctx: RequestContext): Promise<ShipmateConfigEntity | null> {
    return this.connection
      .getRepository(ctx, ShipmateConfigEntity)
      .findOne({ where: { channelId: ctx.channelId as string } });
  }

  async getConfigWithWebhookAuthToken(
    webhookAuthToken: string
  ): Promise<ShipmateConfigEntity | null> {
    return this.connection
      .getRepository(ShipmateConfigEntity)
      .findOne({ where: { webhookAuthTokens: webhookAuthToken } });
  }

  async upsertConfig(
    ctx: RequestContext,
    apiKey?: string,
    username?: string,
    password?: string,
    webhookAuthTokens?: string[]
  ): Promise<ShipmateConfigEntity | null> {
    const existing = await this.connection
      .getRepository(ctx, ShipmateConfigEntity)
      .findOne({ where: { channelId: ctx.channelId as string } });
    if (
      (!apiKey || apiKey === '') &&
      (!username || username === '') &&
      (!password || password === '') &&
      !webhookAuthTokens?.length &&
      existing
    ) {
      await this.connection
        .getRepository(ctx, ShipmateConfigEntity)
        .delete(existing.id);
    } else if (existing) {
      await this.connection
        .getRepository(ctx, ShipmateConfigEntity)
        .update(existing.id, { apiKey: apiKey, username, password });
    } else {
      await this.connection.getRepository(ctx, ShipmateConfigEntity).insert({
        apiKey,
        channelId: ctx.channelId as string,
        username,
        password,
        webhookAuthTokens,
      });
    }
    return this.connection
      .getRepository(ctx, ShipmateConfigEntity)
      .findOne({ where: { channelId: ctx.channelId as string } });
  }
}
