import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';
import { SearchService } from '../services/search.service';
import { BetterSearchInput, BetterSearchResultList } from './generated/graphql';

@Resolver()
export class SearchShopResolver {
  constructor(private searchService: SearchService) {}

  @Query()
  async betterSearch(
    @Ctx() ctx: RequestContext,
    @Args() args: { input: BetterSearchInput }
  ): Promise<BetterSearchResultList> {
    return this.searchService.search(ctx, args.input);
  }
}
