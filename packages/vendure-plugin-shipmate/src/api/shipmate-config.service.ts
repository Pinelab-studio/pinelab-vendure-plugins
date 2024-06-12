import { Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection } from '@vendure/core';
import { ShipmateConfigEntity } from './shipmate-config.entity';
import { ShipmateWebhookTokenEntity } from './shipmate-webhook-token.entitiy';

@Injectable()
export class ShipmateConfigService {
  constructor(private connection: TransactionalConnection) {}
  async getConfig(ctx: RequestContext): Promise<ShipmateConfigEntity | null> {
    return this.connection
      .getRepository(ctx, ShipmateConfigEntity)
      .createQueryBuilder('config')
      .innerJoinAndSelect('config.webhookAuthTokens', 'webhookAuthToken')
      .setFindOptions({ where: { channelId: ctx.channelId as string } })
      .getOne();
  }

  async getConfigWithWebhookAuthToken(
    webhookAuthToken: string
  ): Promise<ShipmateConfigEntity | null> {
    return this.connection
      .getRepository(ShipmateConfigEntity)
      .createQueryBuilder('config')
      .innerJoin('config.webhookAuthTokens', 'webhookAuthToken')
      .where('webhookAuthToken.token = :token', {
        token: `${webhookAuthToken}`,
      })
      .getOne();
  }

  async upsertConfig(
    ctx: RequestContext,
    apiKey?: string,
    username?: string,
    password?: string,
    webhookAuthTokens?: string[]
  ): Promise<ShipmateConfigEntity | null> {
    const shipmateConfigRepo = this.connection.getRepository(
      ctx,
      ShipmateConfigEntity
    );
    const existing = await shipmateConfigRepo
      .createQueryBuilder('config')
      .innerJoinAndSelect('config.webhookAuthTokens', 'webhookAuthToken')
      .setFindOptions({ where: { channelId: ctx.channelId as string } })
      .getOne();
    if (
      (!apiKey || apiKey === '') &&
      (!username || username === '') &&
      (!password || password === '') &&
      !webhookAuthTokens?.length &&
      existing
    ) {
      await shipmateConfigRepo.delete(existing.id);
    } else if (existing) {
      existing.apiKey = apiKey!;
      existing.username = username!;
      existing.password = password!;
      existing.webhookAuthTokens = await this.getShipmateWebhookTokenEntities(
        ctx,
        existing,
        webhookAuthTokens ?? []
      );
      await shipmateConfigRepo.save(existing);
    } else {
      const newShipmateConfig = await shipmateConfigRepo.save({
        apiKey,
        channelId: ctx.channelId as string,
        username,
        password,
        webhookAuthTokens: [],
      });
      newShipmateConfig.webhookAuthTokens =
        (await this.getShipmateWebhookTokenEntities(
          ctx,
          newShipmateConfig,
          webhookAuthTokens ?? []
        )) as never[];
      await shipmateConfigRepo.save(newShipmateConfig);
    }
    return this.connection.getRepository(ctx, ShipmateConfigEntity).findOne({
      where: { channelId: ctx.channelId as string },
      relations: ['webhookAuthTokens'],
    });
  }

  private async getShipmateWebhookTokenEntities(
    ctx: RequestContext,
    shipmateConfig: ShipmateConfigEntity,
    tokens: string[]
  ): Promise<ShipmateWebhookTokenEntity[]> {
    const webhooksRepo = this.connection.getRepository(
      ctx,
      ShipmateWebhookTokenEntity
    );
    const configRepo = this.connection.getRepository(ctx, ShipmateConfigEntity);
    const existingAndKept = shipmateConfig.webhookAuthTokens.filter(
      (webhookToken) => !!tokens.find((token) => token === webhookToken.token)
    );
    const existingButNotKept = shipmateConfig.webhookAuthTokens.filter(
      (webhookToken) => !tokens.find((token) => token === webhookToken.token)
    );
    for (const webhookAuthTokenEntity of existingButNotKept) {
      await webhooksRepo.delete(webhookAuthTokenEntity);
    }
    const newWebhooksTokens = tokens.filter(
      (token) =>
        !shipmateConfig.webhookAuthTokens.find(
          (webhookAuthToken) => webhookAuthToken.token === token
        )
    );
    const newShipmateWebhooksTokens: ShipmateWebhookTokenEntity[] = [];
    for (const token of newWebhooksTokens) {
      const webhooksToken = new ShipmateWebhookTokenEntity();
      webhooksToken.shipmateConfig = shipmateConfig;
      webhooksToken.token = token;
      newShipmateWebhooksTokens.push(await webhooksRepo.save(webhooksToken));
    }
    return [...existingAndKept, ...newShipmateWebhooksTokens];
  }
}
