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
   * Supports term, product grouping and pagination; other filters are not implemented.
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
    const matches = await engine.search(ctx, index, term);
    const docs = input.groupByProduct ? this.groupByProduct(matches) : matches;
    const currencyCode = ctx.channel.defaultCurrencyCode;
    const channelId = String(ctx.channel.id);
    const items = docs.map((doc) =>
      this.mapToSearchResult(doc, currencyCode, channelId)
    );
    return {
      items: items.slice(
        input.skip ?? 0,
        input.take == null ? undefined : (input.skip ?? 0) + input.take
      ),
      totalItems: items.length,
      facetValues: [],
      collections: [],
    };
  }

  /** Groups matching variants, retaining the highest-scoring variant as representative. */
  private groupByProduct(
    documents: BetterSearchDocument[]
  ): BetterSearchDocument[] {
    const products = new Map<string, BetterSearchDocument>();
    for (const document of documents) {
      const previous = products.get(document.productId);
      if (!previous) {
        products.set(document.productId, { ...document });
        continue;
      }
      products.set(document.productId, {
        ...(document.score > previous.score ? document : previous),
        lowestPrice: Math.min(previous.lowestPrice, document.lowestPrice),
        highestPrice: Math.max(previous.highestPrice, document.highestPrice),
        lowestPriceWithTax: Math.min(
          previous.lowestPriceWithTax,
          document.lowestPriceWithTax
        ),
        highestPriceWithTax: Math.max(
          previous.highestPriceWithTax,
          document.highestPriceWithTax
        ),
        facetIds: [...new Set([...previous.facetIds, ...document.facetIds])],
        facetValueIds: [
          ...new Set([...previous.facetValueIds, ...document.facetValueIds]),
        ],
        collectionIds: [
          ...new Set([...previous.collectionIds, ...document.collectionIds]),
        ],
        collectionNames: [
          ...new Set([
            ...previous.collectionNames,
            ...document.collectionNames,
          ]),
        ],
      });
    }
    return [...products.values()].sort((a, b) => b.score - a.score);
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
   * Price is always PriceRange (min/max); asset details come from the search index.
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
      productAsset:
        doc.productAssetId && doc.productAssetPreview
          ? {
              id: doc.productAssetId,
              preview: doc.productAssetPreview,
            }
          : null,
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
