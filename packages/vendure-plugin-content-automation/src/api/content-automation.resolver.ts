import { Args, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
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
  @Allow(Permission.ReadCatalog)
  async contentAutomationUpdates(
    @Ctx() ctx: RequestContext,
    @Args('options') options?: ListQueryOptions<ContentAutomationUpdate>,
  ): Promise<PaginatedList<ContentAutomationUpdate>> {
    return this.service.findUpdates(ctx, options);
  }
}
