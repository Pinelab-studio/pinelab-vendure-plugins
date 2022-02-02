import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Logger, RequestContext } from '@vendure/core';
import {
  GoedgepicktConfig,
  goedgepicktPermission,
  GoedgepicktPluginConfig,
} from '../index';
import { GoedgepicktService } from './goedgepickt.service';
import { GoedgepicktConfigEntity } from './goedgepickt-config.entity';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { Inject } from '@nestjs/common';

@Resolver()
export class GoedgepicktResolver {
  constructor(
    private service: GoedgepicktService,
    @Inject(PLUGIN_INIT_OPTIONS) private config: GoedgepicktPluginConfig
  ) {}

  @Query()
  @Allow(goedgepicktPermission.Permission)
  async goedgepicktConfig(
    @Ctx() ctx: RequestContext
  ): Promise<GoedgepicktConfig | undefined> {
    return this.toGraphqlObject(
      ctx.channel.token,
      await this.service.getConfig(ctx.channel.token)
    );
  }

  @Mutation()
  @Allow(goedgepicktPermission.Permission)
  async updateGoedgepicktConfig(
    @Ctx() ctx: RequestContext,
    @Args('input') input: { apiKey: string; webshopUuid: string }
  ): Promise<GoedgepicktConfig | undefined> {
    await this.service.upsertConfig({
      channelToken: ctx.channel.token,
      ...input,
    });
    const config = await this.service.setWebhooks(ctx.channel.token);
    return this.toGraphqlObject(ctx.channel.token, config);
  }

  @Mutation()
  @Allow(goedgepicktPermission.Permission)
  async runGoedgepicktFullSync(@Ctx() ctx: RequestContext): Promise<boolean> {
    let errorMessage: string;
    await this.service.pushProducts(ctx.channel.token).catch((err) => {
      Logger.error(
        `Failed to push products for channel ${ctx.channel.token}`,
        loggerCtx,
        err
      );
      errorMessage = 'Failed to push products. \n';
    });
    await this.service.pullStocklevels(ctx.channel.token).catch((err) => {
      Logger.error(
        `Failed to pull stocklevels for channel ${ctx.channel.token}`,
        loggerCtx,
        err
      );
      errorMessage += 'Failed to pull stocklevels.';
    });
    if (errorMessage!) {
      throw Error(errorMessage);
    }
    return true;
  }

  private toGraphqlObject(
    channelToken: string,
    config?: GoedgepicktConfigEntity
  ): GoedgepicktConfig | undefined {
    const webhookUrl = this.service.getWebhookUrl(channelToken);
    return {
      __typename: 'GoedgepicktConfig',
      ...config,
      orderWebhookUrl: webhookUrl,
      stockWebhookUrl: webhookUrl,
    };
  }
}
