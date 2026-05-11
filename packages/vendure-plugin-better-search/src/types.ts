import { ProductVariant, RequestContext } from '@vendure/core';

/**
 * Internal document type returned by search engines.
 * Contains all fields needed to construct a Vendure SearchResult.
 */
export interface BetterSearchDocument {
  /** Variant ID (equals the document id in the search index) */
  productVariantId: string;
  productId: string;
  productName: string;
  /** Fallback to productName when variant name is not separately loaded */
  productVariantName: string;
  slug: string;
  description: string;
  sku: string;
  /** Lowest price across variants (in channel's minor currency unit) */
  lowestPrice: number;
  lowestPriceWithTax: number;
  /** Highest price across variants (in channel's minor currency unit) */
  highestPrice: number;
  highestPriceWithTax: number;
  /** Parent facet IDs (deduped) */
  facetIds: string[];
  facetValueIds: string[];
  collectionIds: string[];
  collectionNames: string[];
  score: number;
}

/**
 * @description
 * The plugin can be configured using the following options:
 */
export interface BetterSearchOptions {
  /**
   * The debounce time for index rebuilds.
   *
   * E.g. 5000 means that if a product is updated,
   * the plugin will wait for 5 seconds for more events to come in, and then rebuild the index.
   */
  debounceIndexRebuildMs?: number;
}

/**
 * A strategy to create a search index and search for results.
 */
export interface SearchEngine {
  /**
   * Function that creates the index based on given documents.
   * Should return a serialized version of the index.
   */
  createIndex(
    ctx: RequestContext,
    documents: ProductVariant[]
  ): Promise<unknown>;

  search(
    ctx: RequestContext,
    searchIndex: unknown,
    term: string
  ): Promise<BetterSearchDocument[]>;

  /**
   * Extracts stored documents from the index for inspection purposes.
   * Returns each document as a plain JSON-serializable object.
   */
  getDocuments(
    searchIndex: unknown,
    skip: number,
    take: number
  ): Promise<Record<string, unknown>[]>;

  /**
   * Serializes the in-memory index to a string for database storage.
   */
  serializeIndex(searchIndex: unknown): string;

  /**
   * Deserializes a string from the database back into an in-memory index.
   */
  deserializeIndex(serialized: string): unknown;
}
