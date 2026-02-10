import { Inject, Injectable } from '@nestjs/common';
import { ID, LanguageCode, RequestContext } from '@vendure/core';
import MiniSearch from 'minisearch';
import { BetterSearchResult } from '../api/generated/graphql';
import { BETTER_SEARCH_PLUGIN_OPTIONS } from '../constants';
import { BetterSearchOptions } from '../types';
import { IndexService } from './index.service';

interface CachedIndex {
  channelId: ID;
  languageCode: LanguageCode;
  cachedAt: Date;
  index: MiniSearch;
}

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
    return this.options.searchStrategy.search(ctx, term);
  }
}
