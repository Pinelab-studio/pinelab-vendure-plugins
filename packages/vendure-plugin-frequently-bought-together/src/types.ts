import { ID, RequestContext, ScheduledTaskConfig } from '@vendure/core';
import { Itemset } from 'node-fpgrowth';

/**
 * @description
 * Configures the built-in scheduled task that recalculates "frequently bought
 * together" relations for all channels. The task is **always enabled**; this
 * only lets you change when it runs. Requires the `DefaultSchedulerPlugin` to
 * actually run.
 *
 * Defaults to nightly at 3:00 AM. Override the `schedule` (and optionally
 * `timeout`), e.g. `{ schedule: (cron) => cron.everyDayAt(4, 0) }`.
 */
export type ScheduledTaskOption = Partial<
  Pick<ScheduledTaskConfig, 'schedule' | 'timeout'>
>;

/**
 * @description
 * The plugin can be configured using the following options:
 */
export interface PluginInitOptions {
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
  /**
   * The maximum number of related products to store per product
   */
  maxRelatedProducts: number;
  /**
   * The recalculation scheduled task is always enabled (nightly at 3:00 AM).
   * Use this to change when it runs. See {@link ScheduledTaskOption}.
   */
  scheduledTask?: ScheduledTaskOption;
}

export interface FrequentlyBoughtTogetherCalculationResult {
  itemSets: Itemset<ID>[];
  maxMemoryUsedInMB: number;
  uniqueProducts: number;
}

export interface Support {
  productId: ID;
  support: number;
}
