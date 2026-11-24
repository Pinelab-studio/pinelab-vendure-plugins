import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  ID,
  ListQueryOptions,
  PaginatedList,
  Permission,
  RequestContext,
} from '@vendure/core';
import { ContentAutomationUpdate } from '../entities/content-automation-update.entity';
import { ContentAutomationService } from '../services/content-automation.service';

@Resolver()
export class ContentAutomationResolver {
  constructor(private readonly service: ContentAutomationService) {}

  @Query()
  @Allow(Permission.UpdateProduct)
  async contentAutomationUpdates(
    @Ctx() ctx: RequestContext,
    @Args('options') options?: ListQueryOptions<ContentAutomationUpdate>,
  ): Promise<PaginatedList<ContentAutomationUpdate>> {
    return this.service.findUpdates(ctx, options);
  }

  @Mutation()
  @Allow(Permission.UpdateProduct)
  async runContentAutomationForProduct(
    @Ctx() ctx: RequestContext,
    @Args('productId') productId: ID,
  ): Promise<{ jobsCreated: number }> {
    return this.service.createJobsForProduct(ctx, productId);
  }
}
