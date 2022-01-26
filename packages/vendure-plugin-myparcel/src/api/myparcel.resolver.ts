import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { MyparcelService } from './myparcel.service';
import { myparcelPermission } from '../index';
import { MyparcelConfigEntity } from './myparcel-config.entity';

/**
 * Graphql resolvers for retrieving and updating myparcel configs for channel
 */
@Resolver()
export class MyparcelResolver {
  constructor(private service: MyparcelService) {}

  @Query()
  @Allow(myparcelPermission.Permission)
  async myparcelConfig(
    @Ctx() ctx: RequestContext
  ): Promise<MyparcelConfigEntity | undefined> {
    return this.service.getConfig(ctx.channelId as string);
  }

  @Mutation()
  @Allow(myparcelPermission.Permission)
  async updateMyparcelConfig(
    @Ctx() ctx: RequestContext,
    @Args('input') input: { apiKey: string }
  ): Promise<MyparcelConfigEntity | void> {
    return this.service.upsertConfig({
      apiKey: input.apiKey,
      channelId: ctx.channelId as string,
    });
  }
}
