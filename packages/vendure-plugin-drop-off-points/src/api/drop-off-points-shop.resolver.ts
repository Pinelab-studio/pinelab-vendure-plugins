import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';
import { DropOffPointsService } from '../services/drop-off-points.service';
import {
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
}
