import { Collection, Product } from '@vendure/core';
import { BetterSearchResult } from './api/generated/graphql';

export type SearchDocument = BetterSearchResult & Record<string, unknown>;

/**
 * @description
 * The plugin can be configured using the following options:
 */
export interface PluginInitOptions {
  /**
   * Map a product to a Search Document.
   * This is called when creating the index
   */
  mapToSearchDocument: (
    product: Product,
    collectionForThisProduct: Collection[]
  ) => SearchDocument;
  /**
   * The fields and corresponding weights that should be indexed.
   * These should should correspond to what you return in the mapToSearchDocument function.
   */
  indexableFields: Record<string, number>;
  /**
   * The fuzziness of the search.
   * 0.0 is no fuzzyness, 1.0 is full fuzzyness.
   */
  fuzziness: number;

  /**
   * The debounce time for index rebuilds.
   *
   * E.g. 5000 means that if a product is updated,
   * the plugin will wait for 5 seconds for more events to come in, and then rebuild the index.
   */
  debounceIndexRebuildMs: number;
}
