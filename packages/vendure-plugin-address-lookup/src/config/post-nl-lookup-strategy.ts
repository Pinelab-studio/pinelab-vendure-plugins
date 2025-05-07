import { OrderAddress } from '@vendure/common/lib/generated-types';
import { Logger, RequestContext } from '@vendure/core';
import { asError } from 'catch-unknown';
import { AddressLookupInput } from '../generated/graphql';
import { LookupStrategy } from '../types';
import {
  normalizePostalCode,
  validateDutchPostalCode,
} from './validation-util';

interface PostNLAddressResponse {
  streetName: string;
  cityName: string;
}

interface PostNLErrorResponse {
  errors: Array<{
    message: string;
    code: string;
  }>;
}

const loggerCtx = 'PostNLLookupStrategy';

interface PostNLLookupStrategyInput {
  apiKey: string;
  countryCode: 'NL' | 'BE';
}

/**
 * Address lookup strategy that supports both NL and BE lookups
 *
 */
export class PostNLLookupStrategy implements LookupStrategy {
  readonly countryCode: string;

  constructor(private readonly input: PostNLLookupStrategyInput) {
    this.countryCode = input.countryCode;
  }

  validateInput?(input: AddressLookupInput): true | string {
    if (this.countryCode === 'NL') {
      return this.validateNLPostalCode(input);
    } else if (this.countryCode === 'BE') {
      return this.validateBEPostalCode(input);
    }
    return `Invalid country code: ${this.countryCode}`;
  }

  async lookup(
    ctx: RequestContext,
    input: AddressLookupInput
  ): Promise<OrderAddress[]> {
    try {
      const postalCode = normalizePostalCode(input.postalCode);
      let url = `https://api.postnl.nl/v2/address/benelux?countryIso=${this.countryCode}&houseNumber=${input.houseNumber}&postalCode=${postalCode}`;
      if (input.streetName) {
        url += `&streetName=${input.streetName}`;
      }
      url =
        'https://api.postnl.nl/v2/address/benelux?countryIso=BE&cityName=Antwerpen&streetName=Grotesteenweg&houseNumber=521&bus=1';

      console.log(url, this.input.apiKey);

      const result = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          apikey: this.input.apiKey,
        },
      });

      console.log(result.status);
      console.log(result.statusText);

      if (!result.ok) {
        throw new Error(
          `PostNL API returned status ${result.status}: ${result.statusText}`
        );
      }
      // Valid results, map to OrderAddress
      const resultJson = (await result.json()) as PostNLAddressResponse[];
      console.log(JSON.stringify(resultJson, null, 2));
      return resultJson.map((result) => ({
        fullName: '',
        company: '',
        streetLine1: result.streetName,
        streetLine2: '',
        city: result.cityName,
        province: '',
        postalCode: this.normalizePostalCode(input.postalCode),
        country: 'Netherlands',
        phoneNumber: '',
      }));
    } catch (error) {
      Logger.error(
        `Error calling PostNL API: ${asError(error).message}`,
        loggerCtx
      );
      return [];
    }
  }

  private validateNLPostalCode(input: AddressLookupInput): true | string {
    return validateDutchPostalCode(input);
  }

  private validateBEPostalCode(input: AddressLookupInput): true | string {
    const postalCode = input.postalCode;
    if (postalCode.length !== 4) {
      return `Postal code for '${this.countryCode}' code must be 4 numbers`;
    }
    if (!/^\d{4}$/.test(postalCode)) {
      return `Postal code must be 4 numbers for '${this.countryCode}'`;
    }
    if (!input.houseNumber) {
      return `House number is required for lookup in '${this.countryCode}'`;
    }
    if (!input.streetName) {
      return `Street name is required for lookup in '${this.countryCode}'`;
    }
    return true;
  }
}
