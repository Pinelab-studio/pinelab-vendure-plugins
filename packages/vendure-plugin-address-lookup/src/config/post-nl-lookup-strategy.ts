import { OrderAddress } from '@vendure/common/lib/generated-types';
import { RequestContext } from '@vendure/core';
import { AddressLookupInput } from '../generated/graphql';
import { AddressLookupStrategy } from '../types';
import {
  normalizePostalCode,
  validateDutchPostalCode,
} from './validation-util';

interface PostNLAddressResponse {
  streetName: string;
  cityName: string;
  countryName: string;
  houseNumber: string;
  stateName: string;
  countryIso2: string;
}

interface PostNLLookupStrategyInput {
  apiKey: string;
}

/**
 * Address lookup strategy that supports both NL and BE lookups
 */
export class PostNLLookupStrategy implements AddressLookupStrategy {
  readonly supportedCountryCodes = ['NL', 'BE'];

  constructor(private readonly input: PostNLLookupStrategyInput) {}

  validateInput(input: AddressLookupInput): true | string {
    const countryCode = input.countryCode.toLowerCase();
    if (countryCode === 'nl') {
      return this.validateNLPostalCode(input);
    } else if (countryCode === 'be') {
      return this.validateBEPostalCode(input);
    }
    return `Invalid country code: ${input.countryCode}`;
  }

  async lookup(
    ctx: RequestContext,
    input: AddressLookupInput
  ): Promise<OrderAddress[]> {
    const countryCode = input.countryCode.toLowerCase();
    const postalCode = normalizePostalCode(input.postalCode);
    const { houseNumber, addition } = this.parseHouseNumber(input.houseNumber!);
    let url = `https://api.postnl.nl/v2/address/benelux?countryIso=${countryCode}&houseNumber=${houseNumber}&postalCode=${postalCode}`;
    if (input.streetName) {
      url += `&streetName=${input.streetName}`;
    }
    if (addition) {
      url += `&houseNumberAddition=${addition}`;
    }
    const result = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        apikey: this.input.apiKey,
      },
    });
    if (!result.ok) {
      throw new Error(
        `PostNL API returned status ${result.status}: ${result.statusText}`
      );
    }
    // Valid results, map to OrderAddress
    const resultJson = (await result.json()) as PostNLAddressResponse[];
    console.log(resultJson);
    return resultJson.map((result) => ({
      fullName: '',
      company: '',
      streetLine1: result.streetName,
      streetLine2: result.houseNumber,
      city: result.cityName,
      province: result.stateName,
      postalCode,
      country: result.countryName,
      countryCode: result.countryIso2,
      phoneNumber: '',
    }));
  }

  private validateNLPostalCode(input: AddressLookupInput): true | string {
    return validateDutchPostalCode(input);
  }

  private validateBEPostalCode(input: AddressLookupInput): true | string {
    const countryCode = input.countryCode;
    const postalCode = input.postalCode;
    if (postalCode.length !== 4) {
      return `Postal code for '${countryCode}' code must be 4 numbers`;
    }
    if (!/^\d{4}$/.test(postalCode)) {
      return `Postal code must be 4 numbers for '${countryCode}'`;
    }
    if (!input.houseNumber) {
      return `House number is required for lookup in '${countryCode}'`;
    }
    return true;
  }

  parseHouseNumber(houseNumberAndAddition: string): {
    houseNumber: number;
    addition?: string;
  } {
    const match = houseNumberAndAddition.match(/^(\d+)(.*)$/);
    if (!match) {
      throw new Error('Invalid house number');
    }
    const [, houseNumber, addition] = match;
    const cleanedUpAddition = addition.trim().replace(/[ -]/g, '');
    return {
      houseNumber: parseInt(houseNumber),
      addition: cleanedUpAddition || undefined,
    };
  }
}
