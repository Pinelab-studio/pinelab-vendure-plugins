import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { goedgepicktPermission } from '../index';
import { GoedgepicktService } from './goedgepickt.service';
import { GoedgepicktConfigEntity } from './goedgepickt-config.entity';

@Resolver()
export class GoedgepicktResolver {
  constructor(private service: GoedgepicktService) {}

  @Query()
  @Allow(goedgepicktPermission.Permission)
  async goedgepicktConfig(
    @Ctx() ctx: RequestContext
  ): Promise<GoedgepicktConfigEntity | undefined> {
    return this.service.getConfig(ctx.channelId as string);
  }

  @Mutation()
  @Allow(goedgepicktPermission.Permission)
  async updateGoedgepicktConfig(
    @Ctx() ctx: RequestContext,
    @Args('input') input: { apiKey: string; webshopUuid: string }
  ): Promise<GoedgepicktConfigEntity | void> {
    return this.service.upsertConfig({
      channelId: ctx.channelId as string,
      ...input,
    });
  }

  @Mutation()
  @Allow(goedgepicktPermission.Permission)
  async pushProductsToGoedgepickt(
    @Ctx() ctx: RequestContext
  ): Promise<boolean> {
    return false;
  }

  @Mutation()
  @Allow(goedgepicktPermission.Permission)
  async pullGoedgepicktStocklevels(
    @Ctx() ctx: RequestContext
  ): Promise<boolean> {
    return false;
  }
}

pushProductsToGoedgepickt: Boolean;
pullGoedgepicktStocklevels: Boolean;
