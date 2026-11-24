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

  /** Lists product strategy names for the manual Dashboard actions. */
  @Query()
  @Allow(Permission.UpdateProduct)
  productContentAutomationStrategies(): string[] {
    return this.service.getProductStrategyNames();
  }

  /** Runs a selected product strategy and returns its completed results. */
  @Mutation()
  @Allow(Permission.UpdateProduct)
  runContentAutomationStrategyForProduct(
    @Ctx() ctx: RequestContext,
    @Args('productId') productId: ID,
    @Args('strategyName') strategyName: string,
  ) {
    return this.service.runStrategyForProduct(ctx, productId, strategyName);
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
