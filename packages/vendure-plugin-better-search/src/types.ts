import { Injector, ProductVariant, RequestContext } from '@vendure/core';
import { BetterSearchResult } from './api/generated/graphql';

/**
 * @description
 * The plugin can be configured using the following options:
 */
export interface BetterSearchOptions {
  /**
   * Map a product to a Search Document.
   * This is called when creating the index
   */
  searchStrategy: SearchEngine<ProductVariant>;
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
 *
 * FIXME: this is just temporary, to test different engines and algorithms.
 */
export interface SearchEngine<Document extends ProductVariant> {
  /**
   * Injector is passed to enrich documents with additional data if needed.
   */
  createIndex: (
    ctx: RequestContext,
    documents: Document[],
    injector: Injector
  ) => Promise<void>;
  search(ctx: RequestContext, term: string): Promise<BetterSearchResult[]>;
}
