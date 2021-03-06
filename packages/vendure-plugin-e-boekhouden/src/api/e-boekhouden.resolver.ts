import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { EBoekhoudenService } from './e-boekhouden.service';
import {
  EBoekhoudenConfig,
  EBoekhoudenConfigInput,
} from '../ui/generated/graphql';
import { eBoekhoudenPermission } from '../index';

@Resolver()
export class EBoekhoudenResolver {
  constructor(private service: EBoekhoudenService) {}

  @Query()
  @Allow(eBoekhoudenPermission.Permission)
  async eBoekhoudenConfig(
    @Ctx() ctx: RequestContext
  ): Promise<EBoekhoudenConfig | undefined> {
    return this.service.getConfig(ctx.channel.token);
  }

  @Mutation()
  @Allow(eBoekhoudenPermission.Permission)
  async updateEBoekhoudenConfig(
    @Ctx() ctx: RequestContext,
    @Args('input') input: EBoekhoudenConfigInput
  ): Promise<EBoekhoudenConfig | undefined> {
    return this.service.upsertConfig(ctx.channel.token, input);
  }
}
