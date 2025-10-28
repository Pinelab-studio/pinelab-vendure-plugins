import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext, Transaction } from '@vendure/core';
import { UTMTrackerService } from '../services/utm-tracker.service';
import { UTMParameterInput } from '../types';

@Resolver()
export class UTMTrackerShopResolver {
  constructor(private utmTrackerService: UTMTrackerService) {}

  @Mutation()
  @Transaction()
  async addUTMParametersToOrder(
    @Ctx() ctx: RequestContext,
    @Args('inputs') inputs: UTMParameterInput[]
  ): Promise<boolean> {
    return this.utmTrackerService.addMultipleUTMParametersToOrder(ctx, inputs);
  }
}
