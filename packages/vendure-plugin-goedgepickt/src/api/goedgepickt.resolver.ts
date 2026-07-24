import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  Permission,
  RequestContext,
  PermissionDefinition,
} from '@vendure/core';
import { MutationSyncOrderToGoedgepicktArgs } from '../index';
import { GoedgepicktService } from './goedgepickt.service';

export const goedgepicktPermission = new PermissionDefinition({
  name: 'SetGoedgepicktConfig',
  description: 'Allows setting Goedgepickt configurations',
});
@Resolver()
export class GoedgepicktResolver {
  constructor(private service: GoedgepicktService) {}

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
