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
    @Inject(PLUGIN_INIT_OPTIONS) private pluginConfig: GoedgepicktPluginConfig
  ) {}

  @Mutation()
  @Allow(goedgepicktPermission.Permission)
  async runGoedgepicktFullSync(@Ctx() ctx: RequestContext): Promise<boolean> {
    const channelToken = ctx.channel.token;
    await this.service.doFullSync(channelToken);
    if (this.pluginConfig.setWebhook) {
      await this.service.registerWebhooks(ctx);
    }
    return true;
  }

  @Mutation()
  @Allow(Permission.UpdateOrder)
  async syncOrderToGoedgepickt(
    @Ctx() ctx: RequestContext,
    @Args() input: MutationSyncOrderToGoedgepicktArgs
  ): Promise<boolean> {
    await this.service.pushOrderToGoedGepickt(ctx, input.orderCode);
    return true;
  }
}
