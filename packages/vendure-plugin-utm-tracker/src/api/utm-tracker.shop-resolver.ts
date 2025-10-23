import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext, Transaction } from '@vendure/core';
import { UTMTrackerService } from '../services/utm-tracker.service';
import { UTMParameterInput } from '../types';

@Resolver()
export class UTMTrackerShopResolver {
  constructor(private uTMTrackerService: UTMTrackerService) {}

  @Mutation()
  @Transaction()
  async addUTMParametersToOrder(
    @Ctx() ctx: RequestContext,
    @Args('input') input: UTMParameterInput
  ): Promise<boolean> {
    return this.uTMTrackerService.addUTMParametersToOrder(ctx, input);
  }
}
