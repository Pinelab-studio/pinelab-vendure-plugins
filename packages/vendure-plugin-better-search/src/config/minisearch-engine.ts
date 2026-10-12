import { ID, RequestContext } from '@vendure/core';
import MiniSearch, { Options, SearchOptions } from 'minisearch';
import {
  BetterSearchDocument,
  SearchDocument,
  SearchEngine,
  SearchSuggestion,
} from '../types';

/** Stores arbitrary document fields separately from MiniSearch's internal fields. */
interface StoredDocument {
  id: string;
  document: SearchDocument;
}

/** A MiniSearch index together with its persisted field schema. */
export interface MinisearchIndex {
  indexedFields: string[];
  index: MiniSearch<StoredDocument>;
}

/** Indexes mapped documents; contains only engine-specific configuration. */
export class MinisearchEngine implements SearchEngine<MinisearchIndex> {
  constructor(private readonly options: SearchOptions = {}) {}

  /** Shares indexing and matching settings between creation and reload. */
  private indexOptions(fields: string[]): Options<StoredDocument> {
    return {
      fields,
      storeFields: ['document'],
      extractField: (record, field) =>
        field === 'id'
          ? record.id
          : field === 'document'
          ? record.document
          : record.document[field],
      searchOptions: {
        ...this.options,
        boost: this.options.boost ?? {
          productName: 2,
          slug: 1.5,
          description: 1,
        },
        prefix: this.options.prefix ?? true,
        fuzzy: this.options.fuzzy ?? 0.2,
      },
    };
  }

  /** Builds an index from complete documents and an explicit field list. */
  async createIndex(
    _ctx: RequestContext,
    documents: SearchDocument[],
    indexedFields: string[]
  ): Promise<MinisearchIndex> {
    const fields = [...new Set(indexedFields)];
    const index = new MiniSearch<StoredDocument>(this.indexOptions(fields));
    index.addAll(documents.map((document) => ({ id: document.id, document })));
    return { indexedFields: fields, index };
  }

  /** Replaces supplied documents without changing the full index's field schema. */
  async updateDocuments(
    _ctx: RequestContext,
    searchIndex: MinisearchIndex,
    documents: SearchDocument[]
  ): Promise<MinisearchIndex> {
    const { index } = searchIndex;
    index.discardAll(documents.filter((d) => index.has(d.id)).map((d) => d.id));
    index.addAll(documents.map((document) => ({ id: document.id, document })));
    return searchIndex;
  }

  /** Removes documents by variant or parent product ID. */
  async removeDocuments(
    _ctx: RequestContext,
    searchIndex: MinisearchIndex,
    variantIds: ID[],
    productIds: ID[]
  ): Promise<MinisearchIndex> {
    const variants = new Set(variantIds.map(String));
    const products = new Set(productIds.map(String));
    searchIndex.index.discardAll(
      this.storedDocuments(searchIndex)
        .filter((d) => variants.has(d.id) || products.has(d.productId))
        .map((d) => d.id)
    );
    return searchIndex;
  }

  /** Returns all supplied fields for inspection. */
  async getDocuments(
    searchIndex: MinisearchIndex,
    skip: number,
    take: number
  ): Promise<Record<string, unknown>[]> {
    return this.storedDocuments(searchIndex).slice(skip, skip + take);
  }

  /** Converts engine hits into the shared storefront result contract. */
  async search(
    _ctx: RequestContext,
    searchIndex: MinisearchIndex,
    term: string
  ): Promise<BetterSearchDocument[]> {
    const hits = searchIndex.index.search(term, {
      prefix: true,
      fuzzy: 0.3,
      boostDocument: (_id, word, fields) => {
        const document = fields?.document as SearchDocument | undefined;
        return document?.productName === word || document?.slug === word
          ? 1.2
          : 1;
      },
      ...this.options,
    });
    return hits.map((hit) => {
      const d = hit.document as SearchDocument;
      return {
        productVariantId: d.id,
        productId: d.productId,
        productName: d.productName,
        productVariantName: d.productName,
        productAssetId: d.productAssetId || null,
        productAssetPreview: d.productAssetPreview || null,
        slug: d.slug,
        description: d.description,
        sku: d.sku,
        lowestPrice: d.price,
        highestPrice: d.price,
        lowestPriceWithTax: d.priceWithTax,
        highestPriceWithTax: d.priceWithTax,
        facetIds: d.facetIds,
        facetValueIds: d.facetValueIds,
        collectionIds: d.collectionIds,
        collectionNames: d.collectionNames,
        score: Math.round(hit.score * 100) / 100,
      };
    });
  }

  /** Suggests up to ten unique terms with engine-configured matching. */
  searchSuggestions(
    _ctx: RequestContext,
    searchIndex: MinisearchIndex,
    term: string
  ): SearchSuggestion[] {
    return [
      ...new Set(searchIndex.index.autoSuggest(term).map((r) => r.suggestion)),
    ]
      .slice(0, 10)
      .map((suggestion) => ({ suggestion }));
  }

  /** Persists the schema with the index so reloads need no mapping callback. */
  serializeIndex(searchIndex: MinisearchIndex): string {
    return JSON.stringify({
      version: 1,
      indexedFields: searchIndex.indexedFields,
      index: searchIndex.index,
    });
  }

  /** Restores a mapped-document index; legacy indexes require manual rebuilding. */
  deserializeIndex(serialized: string): MinisearchIndex {
    const data = JSON.parse(serialized);
    if (
      data.version !== 1 ||
      !Array.isArray(data.indexedFields) ||
      !data.index
    ) {
      throw new Error('Unsupported search index format. Run a full reindex.');
    }
    return {
      indexedFields: data.indexedFields,
      index: MiniSearch.loadJSON<StoredDocument>(
        JSON.stringify(data.index),
        this.indexOptions(data.indexedFields)
      ),
    };
  }

  /** Extracts complete documents from the stored payload. */
  private storedDocuments(searchIndex: MinisearchIndex): SearchDocument[] {
    return Object.values(searchIndex.index.toJSON().storedFields).map(
      (fields) => fields.document as SearchDocument
    );
  }
}
