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

  async upsertConfig(
    ctx: RequestContext,
    apiKey: string
  ): Promise<ShipmateConfigEntity | null> {
    const existing = await this.connection
      .getRepository(ctx, ShipmateConfigEntity)
      .findOne({ where: { channelId: ctx.channelId as string } });
    if ((!apiKey || apiKey === '') && existing) {
      await this.connection
        .getRepository(ctx, ShipmateConfigEntity)
        .delete(existing.id);
    } else if (existing) {
      await this.connection
        .getRepository(ctx, ShipmateConfigEntity)
        .update(existing.id, { apiKey: apiKey });
    } else {
      await this.connection
        .getRepository(ctx, ShipmateConfigEntity)
        .insert({ apiKey, channelId: ctx.channelId as string });
    }
    return this.connection
      .getRepository(ctx, ShipmateConfigEntity)
      .findOne({ where: { channelId: ctx.channelId as string } });
  }
}
