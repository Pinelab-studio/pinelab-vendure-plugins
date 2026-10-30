import { Inject, Injectable } from '@nestjs/common';
import { CurrencyCode, RequestContext } from '@vendure/core';
import type {
  SearchInput,
  SearchResponse,
  SearchResult,
} from '@vendure/common/lib/generated-types';
import { BETTER_SEARCH_PLUGIN_OPTIONS } from '../constants';
import {
  BetterSearchDocument,
  BetterSearchOptions,
  SearchDocument,
  SearchSuggestion,
} from '../types';
import { IndexService } from './index.service';
import { SearchLogService } from './search-log.service';

@Injectable()
export class SearchService {
  constructor(
    private indexService: IndexService,
    @Inject(BETTER_SEARCH_PLUGIN_OPTIONS)
    private options: BetterSearchOptions,
    private searchLogService: SearchLogService
  ) {}

  /**
   * Executes a full-text search using the configured engine and maps results
   * to Vendure's standard SearchResponse shape.
   * Supports term search, existing Vendure facet and collection filters, grouping,
   * and pagination.
   */
  async search(
    ctx: RequestContext,
    input: SearchInput
  ): Promise<SearchResponse> {
    const term = input.term ?? '';
    const hasFilters = Boolean(
      input.facetValueIds?.length ||
        input.facetValueFilters?.length ||
        input.collectionId ||
        input.collectionIds?.length
    );
    if (term.length < 2 && !hasFilters) {
      return { items: [], totalItems: 0, facetValues: [], collections: [] };
    }
    const index = await this.indexService.getIndex(ctx);
    const matches =
      term.length >= 2
        ? await this.options.searchEngine!.search(ctx, index, term)
        : (
            await this.options.searchEngine!.getDocuments(
              index,
              0,
              Number.MAX_SAFE_INTEGER
            )
          ).map((doc) => this.mapStoredDocument(doc));
    const filtered = matches.filter((doc) => this.matchesFilters(doc, input));
    const docs = input.groupByProduct
      ? this.groupByProduct(filtered)
      : filtered;
    const skip = input.skip ?? 0;
    const paginatedDocs = docs.slice(
      skip,
      input.take == null ? undefined : skip + input.take
    );
    const currencyCode = ctx.channel.defaultCurrencyCode;
    const channelId = String(ctx.channel.id);
    const response: SearchResponse = {
      items: paginatedDocs.map((doc) =>
        this.mapToSearchResult(ctx, doc, currencyCode, channelId)
      ),
      totalItems: docs.length,
      facetValues: [],
      collections: [],
    };
    if (term.length >= 2) {
      this.searchLogService.record(ctx, term, response.totalItems);
    }
    return response;
  }

  /** Converts engine-independent stored data into the shared result document shape. */
  private mapStoredDocument(
    stored: Record<string, unknown>
  ): BetterSearchDocument {
    const document = (stored.document ?? stored) as SearchDocument;
    return {
      document,
      productVariantId: String(document.id),
      productId: String(document.productId),
      productName: String(document.productName ?? ''),
      productVariantName: String(document.productName ?? ''),
      productAssetId: document.productAssetId || null,
      productAssetPreview: document.productAssetPreview || null,
      slug: String(document.slug ?? ''),
      description: String(document.description ?? ''),
      sku: String(document.sku ?? ''),
      lowestPrice: Number(document.price ?? 0),
      highestPrice: Number(document.price ?? 0),
      lowestPriceWithTax: Number(document.priceWithTax ?? 0),
      highestPriceWithTax: Number(document.priceWithTax ?? 0),
      facetIds: document.facetIds ?? [],
      facetValueIds: document.facetValueIds ?? [],
      collectionIds: document.collectionIds ?? [],
      collectionNames: document.collectionNames ?? [],
      score: 0,
    };
  }

  /** Matches a document against Vendure's facet and collection filter inputs. */
  private matchesFilters(
    document: BetterSearchDocument,
    input: SearchInput
  ): boolean {
    const requestedCollectionIds = [
      ...(input.collectionId ? [String(input.collectionId)] : []),
      ...(input.collectionIds ?? []).map(String),
    ];
    if (
      requestedCollectionIds.length &&
      !requestedCollectionIds.some((id) => document.collectionIds.includes(id))
    ) {
      return false;
    }
    const filterGroups = new Map<string, { and: string[]; or: string[] }>();
    for (const filter of input.facetValueFilters ?? []) {
      if (filter.and != null) {
        const ids = (Array.isArray(filter.and) ? filter.and : [filter.and]).map(
          String
        );
        const key = 'and';
        const group = filterGroups.get(key) ?? { and: [], or: [] };
        group.and.push(...ids);
        filterGroups.set(key, group);
      }
      if (filter.or != null) {
        const ids = (Array.isArray(filter.or) ? filter.or : [filter.or]).map(
          String
        );
        const key = 'or';
        const group = filterGroups.get(key) ?? { and: [], or: [] };
        group.or.push(...ids);
        filterGroups.set(key, group);
      }
    }
    for (const group of filterGroups.values()) {
      if (
        group.and.length &&
        !group.and.every((id) => document.facetValueIds.includes(id))
      ) {
        return false;
      }
      if (
        group.or.length &&
        !group.or.some((id) => document.facetValueIds.includes(id))
      ) {
        return false;
      }
    }
    const requiredFacetIds = (input.facetValueIds ?? []).map(String);
    const requireAll = String(input.facetValueOperator).toLowerCase() === 'and';
    if (
      requiredFacetIds.length &&
      (requireAll
        ? !requiredFacetIds.every((id) => document.facetValueIds.includes(id))
        : !requiredFacetIds.some((id) => document.facetValueIds.includes(id)))
    ) {
      return false;
    }
    return true;
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
    return this.options.searchEngine!.searchSuggestions(ctx, index, term);
  }

  /**
   * Maps an internal BetterSearchDocument to Vendure's SearchResult type.
   * Price is always PriceRange (min/max); asset details come from the search index.
   */
  private mapToSearchResult(
    ctx: RequestContext,
    doc: BetterSearchDocument,
    currencyCode: CurrencyCode,
    channelId: string
  ): SearchResult {
    const additionalFields = Object.fromEntries(
      Object.entries(this.options.exposeAdditionalGraphqlFields ?? {}).map(
        ([name, field]) => [name, field.value(ctx, doc.document)]
      )
    );
    return {
      ...additionalFields,
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
