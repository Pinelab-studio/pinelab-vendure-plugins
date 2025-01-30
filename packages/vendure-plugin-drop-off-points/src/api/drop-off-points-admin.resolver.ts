import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Permission } from '@vendure/common/lib/generated-types';
import { ID } from '@vendure/common/lib/shared-types';
import { Allow, Ctx, RequestContext, Transaction } from '@vendure/core';
import { DropOffPointsService } from '../services/drop-off-points.service';

@Resolver()
export class DropOffPointsAdminResolver {
  constructor(private dropOffPointsService: DropOffPointsService) {}

  @Query()
  @Allow(Permission.SuperAdmin)
  async parcelDropOffPoints(
    @Ctx() ctx: RequestContext,
    @Args() args: { id: ID }
  ): Promise<boolean> {
    return this.dropOffPointsService.parcelDropOffPoints(ctx, args.id);
  }

  @Mutation()
  @Transaction()
  @Allow(Permission.SuperAdmin)
  async myNewMutation(
    @Ctx() ctx: RequestContext,
    @Args() args: { id: ID }
  ): Promise<boolean> {
    return this.dropOffPointsService.myNewMutation(ctx, args.id);
  }
}
