import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Job, Permission, RequestContext } from '@vendure/core';
import { engine } from '../constants';
import { IndexService } from '../services/index.service';

@Resolver()
export class SearchAdminResolver {
  constructor(private indexService: IndexService) {}

  /** Queues a full rebuild for the active channel. */
  @Mutation()
  @Allow(Permission.UpdateCatalog)
  reindex(@Ctx() ctx: RequestContext): Promise<Job> {
    return this.indexService.triggerReindex(ctx);
  }

  @Query()
  // @Allow(Permission.SuperAdmin)
  async inspectSearchIndex(
    @Ctx() ctx: RequestContext,
    @Args('skip', { type: () => Number, nullable: true }) skip: number = 0,
    @Args('take', { type: () => Number, nullable: true }) take: number = 10
  ): Promise<Record<string, unknown>[]> {
    const searchIndex = await this.indexService.getIndex(ctx);
    return engine.getDocuments(searchIndex, skip, take);
  }
}
