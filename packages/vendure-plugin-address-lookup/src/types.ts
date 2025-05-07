import { RequestContext } from '@vendure/core';
import { OrderAddress } from '@vendure/common/lib/generated-types';
import { AddressLookupInput } from './generated/graphql';

/**
 * @description
 * The plugin can be configured using the following options:
 */
export interface PluginInitOptions {
  /**
   * @description
   * Strategies to be used for address lookup. This can be a strategy for a different country
   * or lookup using a different API.
   */
  lookupStrategies: LookupStrategy[];
}

export interface LookupStrategy {
  /**
   * @description
   * Unique code that identifies the lookup strategy
   */
  code: string;
  /**
   * @description
   * The name of the lookup strategy. This is used to identify the lookup strategy in the UI.
   */
  lookup(
    ctx: RequestContext,
    input: AddressLookupInput
  ): Promise<OrderAddress[]>;
}
