import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { EBoekhoudenService } from './e-boekhouden.service';
import { PermissionDefinition } from '@vendure/core';

import {
  EBoekhoudenConfig,
  EBoekhoudenConfigInput,
} from '../ui/generated/graphql';
export const eBoekhoudenPermission = new PermissionDefinition({
  name: 'eBoekhouden',
  description: 'Allows enabling e-Boekhouden plugin',
});
@Resolver()
export class EBoekhoudenResolver {
  constructor(private service: EBoekhoudenService) {}

  @Query()
  @Allow(eBoekhoudenPermission.Permission)
  async eBoekhoudenConfig(
    @Ctx() ctx: RequestContext
  ): Promise<EBoekhoudenConfig | null> {
    return this.service.getConfig(ctx.channel.token);
  }

  @Mutation()
  @Allow(eBoekhoudenPermission.Permission)
  async updateEBoekhoudenConfig(
    @Ctx() ctx: RequestContext,
    @Args('input') input: EBoekhoudenConfigInput
  ): Promise<EBoekhoudenConfig | null> {
    return this.service.upsertConfig(ctx.channel.token, input);
  }
}
