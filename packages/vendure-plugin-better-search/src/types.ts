import { Injector, ProductVariant, RequestContext } from '@vendure/core';
import { BetterSearchResult } from './api/generated/graphql';

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
 *
 * FIXME: this is just temporary, to test different engines and algorithms.
 */
export interface SearchEngine {
  /**
   * Function that creates the index based on given documents.
   * Should return a serialized version of the index.
   */
  createIndex: (
    ctx: RequestContext,
    documents: ProductVariant[]
  ) => Promise<unknown>;

  search(
    ctx: RequestContext,
    searchIndex: any,
    term: string
  ): Promise<BetterSearchResult[]>;
}
