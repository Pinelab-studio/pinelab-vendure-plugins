import { Inject, Injectable } from '@nestjs/common';
import { CurrencyCode, RequestContext } from '@vendure/core';
import type {
  SearchInput,
  SearchResponse,
  SearchResult,
} from '@vendure/common/lib/generated-types';
import { BETTER_SEARCH_PLUGIN_OPTIONS, engine } from '../constants';
import {
  BetterSearchDocument,
  BetterSearchOptions,
  SearchSuggestion,
} from '../types';
import { IndexService } from './index.service';

@Injectable()
export class SearchService {
  constructor(
    private indexService: IndexService,
    @Inject(BETTER_SEARCH_PLUGIN_OPTIONS)
    private options: BetterSearchOptions
  ) {}

  /**
   * Executes a full-text search using the configured engine and maps results
   * to Vendure's standard SearchResponse shape.
   * Only the 'term' field of SearchInput is used; all other fields are accepted but ignored.
   */
  async search(
    ctx: RequestContext,
    input: SearchInput
  ): Promise<SearchResponse> {
    const term = input.term ?? '';
    if (term.length < 2) {
      return { items: [], totalItems: 0, facetValues: [], collections: [] };
    }
    const index = await this.indexService.getIndex(ctx);
    const docs = await engine.search(ctx, index, term);
    const currencyCode = ctx.channel.defaultCurrencyCode as CurrencyCode;
    const channelId = String(ctx.channel.id);
    const items = docs.map((doc) =>
      this.mapToSearchResult(doc, currencyCode, channelId)
    );
    return {
      items,
      totalItems: items.length,
      facetValues: [],
      collections: [],
    };
  }

  /**
   * Returns a list of lightweight search suggestions for the given term.
   * Intended for search-as-you-type use cases. This bypasses the index cache
   * TTL check to keep the endpoint fast.
   */
  async searchSuggestions(
    ctx: RequestContext,
    term: string
  ): Promise<SearchSuggestion[]> {
    if (term.length < 2) {
      return [];
    }
    const index = await this.indexService.getIndex(ctx, true);
    return engine.searchSuggestions(ctx, index, term);
  }

  /**
   * Maps an internal BetterSearchDocument to Vendure's SearchResult type.
   * Price is always PriceRange (min/max). Assets are null (not indexed yet).
   */
  private mapToSearchResult(
    doc: BetterSearchDocument,
    currencyCode: CurrencyCode,
    channelId: string
  ): SearchResult {
    return {
      sku: doc.sku,
      slug: doc.slug,
      productId: doc.productId,
      productName: doc.productName,
      productAsset: null,
      productVariantId: doc.productVariantId,
      productVariantName: doc.productVariantName,
      productVariantAsset: null,
      price: { min: doc.lowestPrice, max: doc.highestPrice },
      priceWithTax: {
        min: doc.lowestPriceWithTax,
        max: doc.highestPriceWithTax,
      },
      currencyCode,
      description: doc.description,
      facetIds: doc.facetIds,
      facetValueIds: doc.facetValueIds,
      collectionIds: doc.collectionIds,
      channelIds: [channelId],
      enabled: true,
      score: doc.score,
    } as unknown as SearchResult;
  }
}
