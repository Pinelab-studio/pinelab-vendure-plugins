import { Inject, Injectable } from '@nestjs/common';
import { OrderAddress } from '@vendure/common/lib/generated-types';
import { Logger, RequestContext } from '@vendure/core';
import { ADDRESS_LOOKUP_PLUGIN_OPTIONS, loggerCtx } from '../constants';
import {
  InvalidAddressLookupInputError,
  NoAddressLookupStrategyFoundError,
  PluginInitOptions,
} from '../types';
import { AddressLookupInput } from '../generated/graphql';
import { asError } from 'catch-unknown';

@Injectable()
export class AddressLookupService {
  constructor(
    @Inject(ADDRESS_LOOKUP_PLUGIN_OPTIONS) private options: PluginInitOptions
  ) {}

  async lookupAddress(
    ctx: RequestContext,
    input: AddressLookupInput
  ): Promise<OrderAddress[]> {
    // Find strategy that supports the country code in case insensitive manner
    const countryCode = input.countryCode.toLowerCase();
    const lookupStrategy = this.options.lookupStrategies.find((s) =>
      s.supportedCountryCodes.map((c) => c.toLowerCase()).includes(countryCode)
    );
    if (!lookupStrategy) {
      // No lookup strategy found for 'countryCode'
      throw new NoAddressLookupStrategyFoundError(countryCode);
    }
    if (lookupStrategy.validateInput) {
      // If the strategy has a validateInput method, validate the input, and throw an error if the input is invalid
      const validationResult = lookupStrategy.validateInput(input);
      if (validationResult !== true) {
        throw new InvalidAddressLookupInputError(validationResult);
      }
    }
    return await lookupStrategy.lookup(ctx, input).catch((e) => {
      const error = asError(e);
      Logger.error(
        `Error looking up address via ${lookupStrategy.constructor.name}: ${error.message}`,
        loggerCtx
      );
      throw error;
    });
  }
}
