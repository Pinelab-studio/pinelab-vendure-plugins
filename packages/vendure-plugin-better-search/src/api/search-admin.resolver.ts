import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { engine } from '../constants';
import { IndexService } from '../services/index.service';

@Resolver()
export class SearchAdminResolver {
  constructor(private indexService: IndexService) {}

  @Query()
  @Allow(Permission.SuperAdmin)
  async inspectSearchIndex(
    @Ctx() ctx: RequestContext,
    @Args('skip', { type: () => Number, nullable: true }) skip: number = 0,
    @Args('take', { type: () => Number, nullable: true }) take: number = 10
  ): Promise<Record<string, unknown>[]> {
    const searchIndex = await this.indexService.getIndex(ctx);
    return engine.getDocuments(searchIndex, skip, take);
  }
}
