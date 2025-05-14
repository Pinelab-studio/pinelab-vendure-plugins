import { OrderAddress } from '@vendure/common/lib/generated-types';
import { I18nError, LogLevel, RequestContext } from '@vendure/core';
import { AddressLookupInput } from './generated/graphql';

/**
 * @description
 * The plugin can be configured using the following options:
 */
export interface PluginInitOptions {
  /**
   * @description
   * Strategies to be used for address lookup
   */
  lookupStrategies: AddressLookupStrategy[];
}

export interface AddressLookupStrategy {
  /**
   * @description
   * List of country codes that this lookup strategy can be used for.
   *
   * Case insensitive.
   */
  supportedCountryCodes: string[];
  /**
   * @description
   * Validate the input for the lookup strategy.
   * Returns true if the input is valid, or an error message if the input is invalid.
   */
  validateInput?(input: AddressLookupInput): true | string;
  /**
   * @description
   * The name of the lookup strategy. This is used to identify the lookup strategy in the UI.
   */
  lookup(
    ctx: RequestContext,
    input: AddressLookupInput
  ): Promise<OrderAddress[]>;
}

export class InvalidAddressLookupInputError extends I18nError {
  constructor(message: string) {
    super(message, undefined, 'INVALID_ADDRESS_LOOKUP_INPUT', LogLevel.Info);
  }
}

/**
 * @description
 * Thrown when no lookup strategy is found for the given input.
 */
export class NoAddressLookupStrategyFoundError extends I18nError {
  constructor(countryCode: string) {
    super(
      `No lookup strategy found for country code: ${countryCode}`,
      undefined,
      'NO_ADDRESS_LOOKUP_STRATEGY_FOUND',
      LogLevel.Warn
    );
  }
}
