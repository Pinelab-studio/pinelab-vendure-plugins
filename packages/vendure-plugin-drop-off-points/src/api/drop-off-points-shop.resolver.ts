import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, Order, RequestContext } from '@vendure/core';
import { DropOffPointsService } from '../services/drop-off-points.service';
import {
  MutationSetParcelDropOffPointArgs,
  ParcelDropOffPoint,
  QueryParcelDropOffPointsArgs,
} from '../types-generated-graphql';

@Resolver()
export class DropOffPointsShopResolver {
  constructor(private dropOffPointsService: DropOffPointsService) {}

  @Query()
  async parcelDropOffPoints(
    @Ctx() ctx: RequestContext,
    @Args() args: QueryParcelDropOffPointsArgs
  ): Promise<ParcelDropOffPoint[]> {
    return await this.dropOffPointsService.getDropOffPoints(ctx, args.input);
  }

  @Mutation()
  async setParcelDropOffPoint(
    @Ctx() ctx: RequestContext,
    @Args() { token }: MutationSetParcelDropOffPointArgs
  ): Promise<Order> {
    return await this.dropOffPointsService.setDropOffPointOnOrder(ctx, token);
  }

  @Mutation()
  async unsetParcelDropOffPoint(@Ctx() ctx: RequestContext): Promise<Order> {
    return await this.dropOffPointsService.unsetDropOffPoint(ctx);
  }
}
