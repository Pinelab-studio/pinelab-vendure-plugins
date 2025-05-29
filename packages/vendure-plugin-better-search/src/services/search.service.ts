import { Inject, Injectable } from '@nestjs/common';
import { ID, LanguageCode, Logger, RequestContext } from '@vendure/core';
import { asError } from 'catch-unknown';
import MiniSearch from 'minisearch';
import {
  BetterSearchInput,
  BetterSearchResult,
  BetterSearchResultList,
} from '../api/generated/graphql';
import { BETTER_SEARCH_PLUGIN_OPTIONS, loggerCtx } from '../constants';
import { PluginInitOptions } from '../types';
import { IndexService } from './index.service';

interface CachedIndex {
  channelId: ID;
  languageCode: LanguageCode;
  cachedAt: Date;
  index: MiniSearch;
}

@Injectable()
export class SearchService {
  /**
   * In memory cache of created indices
   */
  private cachedIndices: Map<string, CachedIndex> = new Map();
  private indexTtl = 5 * 60 * 1000; // 5 minutes in milliseconds

  constructor(
    private indexService: IndexService,
    @Inject(BETTER_SEARCH_PLUGIN_OPTIONS) private options: PluginInitOptions
  ) {}

  async search(
    ctx: RequestContext,
    input: BetterSearchInput
  ): Promise<BetterSearchResultList> {
    if (input.term.length < 3) {
      // No search if term is too short
      return {
        items: [],
        totalItems: 0,
      };
    }
    // Get index
    const index = await this.getIndex(ctx);
    const skip = input.skip ?? 0;
    const take = input.take ?? 10;
    const allResults = index.search(
      input.term
    ) as unknown as BetterSearchResult[];
    const results = allResults.slice(skip, skip + take);
    return {
      items: results as unknown as BetterSearchResult[],
      totalItems: allResults.length,
    };
  }

  /**
   * Get index from cache or from DB.
   * Uses Stale-while-revalidate pattern: uses an outdated index if it exists,
   * but fetches a new one from DB in the background.
   */
  private async getIndex(ctx: RequestContext): Promise<MiniSearch> {
    const cacheKey = `${ctx.channel.id}-${ctx.languageCode}`;
    let cachedIndex = this.cachedIndices.get(cacheKey);
    if (!cachedIndex) {
      // Get new index from DB
      const index = await this.indexService.getIndex(ctx);
      if (!index) {
        await this.indexService.triggerReindex(ctx);
        throw Error(
          `No index was created for channel ${ctx.channel.id} and language ${ctx.languageCode}`
        );
      }
      cachedIndex = {
        channelId: ctx.channel.id,
        languageCode: ctx.languageCode,
        cachedAt: new Date(),
        index,
      };
      this.cachedIndices.set(cacheKey, cachedIndex);
    }
    if (cachedIndex.cachedAt < new Date(Date.now() - this.indexTtl)) {
      // Get new index from DB in background - Stale-while-revalidate pattern
      this.indexService
        .getIndex(ctx)
        .then((index) => {
          if (!index) {
            // Do nothing, we still have the old index in cache
            return;
          }
          this.cachedIndices.set(cacheKey, {
            channelId: ctx.channel.id,
            languageCode: ctx.languageCode,
            cachedAt: new Date(),
            index,
          });
        })
        .catch((err) => {
          Logger.error(
            `Failed to fetch new index for '${cacheKey}': ${
              asError(err).message
            }`,
            loggerCtx
          );
        });
    }
    return cachedIndex.index;
  }
}
