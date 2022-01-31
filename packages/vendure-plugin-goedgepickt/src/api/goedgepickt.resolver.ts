import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import {
  GoedgepicktConfig,
  goedgepicktPermission,
  GoedgepicktPluginConfig,
} from '../index';
import { GoedgepicktService } from './goedgepickt.service';
import { GoedgepicktConfigEntity } from './goedgepickt-config.entity';
import { PLUGIN_INIT_OPTIONS } from '../constants';
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
    return this.toGraphqlObject(config);
  }

  @Mutation()
  @Allow(goedgepicktPermission.Permission)
  async runGoedgepicktFullSync(@Ctx() ctx: RequestContext): Promise<boolean> {
    throw Error('didnt work');
    //return true;
  }

  private toGraphqlObject(
    config?: GoedgepicktConfigEntity
  ): GoedgepicktConfig | undefined {
    return {
      __typename: 'GoedgepicktConfig',
      ...config,
      orderWebhookUrl: this.config.vendureHost,
      stockWebhookUrl: this.config.vendureHost,
    };
  }
}
