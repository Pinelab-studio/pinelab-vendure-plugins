import { OrderAddress } from '@vendure/common/lib/generated-types';
import { Logger, RequestContext } from '@vendure/core';
import { AddressLookupInput } from '../generated/graphql';
import { AddressLookupStrategy } from '../types';
import { asError } from 'catch-unknown';
import {
  normalizePostalCode,
  validateDutchPostalCode,
} from './validation-util';

const loggerCtx = 'PostcodeTechStrategy';

interface PostcodeTechResponse {
  postcode: string;
  number: string;
  street: string;
  city: string;
  municipality: string;
  province: string;
  geo?: {
    lat: number;
    lon: number;
  };
}

interface PostcodeTechStrategyInput {
  apiKey: string;
}

/**
 * This strategy is used to lookup NL addresses via Postcode.tech API
 */
export class PostcodeTechStrategy implements AddressLookupStrategy {
  readonly supportedCountryCodes = ['NL'];

  constructor(private readonly input: PostcodeTechStrategyInput) {}

  validateInput(input: AddressLookupInput): true | string {
    return validateDutchPostalCode(input);
  }

  async lookup(
    ctx: RequestContext,
    input: AddressLookupInput
  ): Promise<OrderAddress[]> {
    const postalCode = normalizePostalCode(input.postalCode);
    const result = await fetch(
      `https://postcode.tech/api/v1/postcode/full?postcode=${postalCode}&number=${input.houseNumber}`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.input.apiKey}`,
        },
      }
    );

    if (!result.ok) {
      throw new Error(
        `PostcodeTech API returned status ${result.status}: ${result.statusText}`
      );
    }

    const jsonResult = (await result.json()) as PostcodeTechResponse;
    if (!jsonResult.street) {
      return [];
    }
    return [
      {
        streetLine1: jsonResult.street,
        streetLine2: jsonResult.number,
        city: jsonResult.city,
        province: jsonResult.province,
        postalCode: jsonResult.postcode,
        country: 'Netherlands',
        countryCode: 'NL',
      },
    ];
  }
}
