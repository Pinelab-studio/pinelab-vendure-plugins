import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Allow, Ctx, Job, Permission, RequestContext } from '@vendure/core';
import { engine } from '../constants';
import { IndexService } from '../services/index.service';
import { SearchService } from '../services/search.service';
import type {
  SearchInput,
  SearchResponse,
  Success,
} from '@vendure/common/lib/generated-types';

@Resolver('SearchResponse')
export class SearchAdminResolver {
  constructor(
    private indexService: IndexService,
    private searchService: SearchService
  ) {}

  /** Uses the same search engine as the Shop API. */
  @Query()
  @Allow(Permission.ReadCatalog, Permission.ReadProduct)
  search(
    @Ctx() ctx: RequestContext,
    @Args('input') input: SearchInput
  ): Promise<SearchResponse> {
    return this.searchService.search(ctx, input);
  }

  /** Returns the facets supplied by the engine instead of Vendure's fallback resolver. */
  @ResolveField()
  facetValues(
    @Parent() response: SearchResponse
  ): SearchResponse['facetValues'] {
    return response.facetValues;
  }

  /** Returns the collections supplied by the engine instead of Vendure's fallback resolver. */
  @ResolveField()
  collections(
    @Parent() response: SearchResponse
  ): SearchResponse['collections'] {
    return response.collections;
  }

  /** Automatic updates are not held in a manually flushed job buffer. */
  @Query()
  @Allow(Permission.ReadCatalog, Permission.ReadProduct)
  pendingSearchIndexUpdates(): number {
    return 0;
  }

  /** There is no manual buffer to flush; automatic jobs are already scheduled. */
  @Mutation()
  @Allow(Permission.UpdateCatalog, Permission.UpdateProduct)
  runPendingSearchIndexUpdates(): Success {
    return { success: true };
  }

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
