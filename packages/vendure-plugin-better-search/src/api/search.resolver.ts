import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';
import type {
  SearchInput,
  SearchResponse,
} from '@vendure/common/lib/generated-types';
import { SearchSuggestion } from '../types';
import { SearchService } from '../services/search.service';

@Resolver()
export class SearchShopResolver {
  constructor(private searchService: SearchService) {}

  @Query()
  async search(
    @Ctx() ctx: RequestContext,
    @Args('input') input: SearchInput
  ): Promise<SearchResponse> {
    return this.searchService.search(ctx, input);
  }

  @Query()
  async searchSuggestions(
    @Ctx() ctx: RequestContext,
    @Args('term') term: string
  ): Promise<SearchSuggestion[]> {
    return this.searchService.searchSuggestions(ctx, term);
  }
}
