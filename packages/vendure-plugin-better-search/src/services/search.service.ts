import { Inject, Injectable } from '@nestjs/common';
import { RequestContext } from '@vendure/core';
import { BetterSearchResult } from '../api/generated/graphql';
import { BETTER_SEARCH_PLUGIN_OPTIONS, engine } from '../constants';
import { BetterSearchOptions } from '../types';
import { IndexService } from './index.service';

@Injectable()
export class SearchService {
  constructor(
    private indexService: IndexService,
    @Inject(BETTER_SEARCH_PLUGIN_OPTIONS)
    private options: BetterSearchOptions
  ) {}

  async search(
    ctx: RequestContext,
    term: string
  ): Promise<BetterSearchResult[]> {
    if (term.length < 2) {
      // No search if term is too short
      return [];
    }
    const index = await this.indexService.getIndex(ctx);
    return engine.search(ctx, index, term);
  }
}
