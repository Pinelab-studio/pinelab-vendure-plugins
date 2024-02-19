import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  Permission,
  RequestContext,
  PermissionDefinition,
} from '@vendure/core';
import {
  GoedgepicktConfig,
  GoedgepicktPluginConfig,
  MutationSyncOrderToGoedgepicktArgs,
} from '../index';
import { GoedgepicktService } from './goedgepickt.service';
import { GoedgepicktConfigEntity } from './goedgepickt-config.entity';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { Inject } from '@nestjs/common';

export const goedgepicktPermission = new PermissionDefinition({
  name: 'SetGoedgepicktConfig',
  description: 'Allows setting Goedgepickt configurations',
});
@Resolver()
export class GoedgepicktResolver {
  constructor(
    private service: GoedgepicktService,
    @Inject(PLUGIN_INIT_OPTIONS) private pluginConfig: GoedgepicktPluginConfig,
  ) {}

  @Query()
  @Allow(goedgepicktPermission.Permission)
  async goedgepicktConfig(
    @Ctx() ctx: RequestContext,
  ): Promise<GoedgepicktConfig | null> {
    return this.toGraphqlObject(
      ctx.channel.token,
      await this.service.getConfig(ctx),
    );
  }

  @Mutation()
  @Allow(goedgepicktPermission.Permission)
  async updateGoedgepicktConfig(
    @Ctx() ctx: RequestContext,
    @Args('input') input: { apiKey: string; webshopUuid: string },
  ): Promise<GoedgepicktConfig | null> {
    await this.service.upsertConfig(ctx, input);
    if (this.pluginConfig.setWebhook) {
      await this.service.setWebhooks(ctx);
    }
    // Refetch config, because it now contains webhook secrets
    const config = await this.service.getConfig(ctx);
    return this.toGraphqlObject(ctx.channel.token, config);
  }

  @Mutation()
  @Allow(goedgepicktPermission.Permission)
  async runGoedgepicktFullSync(@Ctx() ctx: RequestContext): Promise<boolean> {
    const channelToken = ctx.channel.token;
    const config = await this.service.getConfig(ctx);
    if (!config?.apiKey || !config?.webshopUuid) {
      throw Error(`No GoedGepickt apiKey set for channel ${channelToken}`);
    }
    await this.service.createFullsyncJobs(channelToken);
    if (this.pluginConfig.setWebhook) {
      await this.service.setWebhooks(ctx);
    }
    return true;
  }

  @Mutation()
  @Allow(Permission.UpdateOrder)
  async syncOrderToGoedgepickt(
    @Ctx() ctx: RequestContext,
    @Args() input: MutationSyncOrderToGoedgepicktArgs,
  ): Promise<boolean> {
    await this.service.syncOrder(ctx, input.orderCode);
    return true;
  }

  private toGraphqlObject(
    channelToken: string,
    config: GoedgepicktConfigEntity | null,
  ): GoedgepicktConfig | null {
    const webhookUrl = this.service.getWebhookUrl(channelToken);
    return {
      __typename: 'GoedgepicktConfig',
      ...config,
      orderWebhookUrl: webhookUrl,
      stockWebhookUrl: webhookUrl,
    };
  }
}
