import { ID, RequestContext } from '@vendure/core';
import { Itemset } from 'node-fpgrowth';

/**
 * @description
 * The plugin can be configured using the following options:
 */
export interface PluginInitOptions {
  /**
   * The maximum number of related products that are automatically added.
   * Manual selection can exceed this limit
   */
  maxRelatedProducts: number;
  /**
   * Defines in what tab the custom field should be displayed in the admin UI.
   * Can be an existing tab.
   */
  customFieldUiTab: string;
  /**
   * Enable experiment mode to test what support level to use for item set generation
   */
  experimentMode: boolean;
  /**
   * The support level to use for item set generation.
   * Example 0.01 means that the item set must be present in 1% of the orders
   * Should be between 0 and 1
   */
  supportLevel: number | ((ctx: RequestContext) => number);
}

export interface FrequentlyBoughtTogetherCalculationResult {
  itemSets: Itemset<ID>[];
  maxMemoryUsedInMB: number;
  uniqueProducts: number;
}
