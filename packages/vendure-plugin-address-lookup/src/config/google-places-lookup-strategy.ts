import { OrderAddress } from '@vendure/common/lib/generated-types';
import { RequestContext } from '@vendure/core';
import { AddressLookupInput } from '../generated/graphql';
import { AddressLookupStrategy } from '../types';

interface GooglePlacesResponse {
  places: Array<{
    addressComponents: Array<{
      longText: string;
      shortText: string;
      types: Array<
        | 'street_number'
        | 'route'
        | 'sublocality_level_1'
        | 'sublocality'
        | 'political'
        | 'locality'
        | 'administrative_area_level_3'
        | 'administrative_area_level_1'
        | 'country'
        | 'postal_code'
      >;
    }>;
  }>;
}

interface GooglePlacesStrategyInput {
  supportedCountryCodes: string[];
  apiKey: string;
}

/**
 * This strategy is used to lookup addresses via Google Places API
 *
 * It requires street name and housenumber to do a good lookup. Optionally a city can be supplied
 */
export class GooglePlacesLookupStrategy implements AddressLookupStrategy {
  readonly supportedCountryCodes: string[];

  constructor(private readonly input: GooglePlacesStrategyInput) {
    this.supportedCountryCodes = input.supportedCountryCodes;
  }

  validateInput(input: AddressLookupInput): true | string {
    if (!input.houseNumber) {
      return 'House number is required for lookup';
    }
    if (!input.streetName) {
      return 'Street name is required for lookup';
    }
    return true;
  }

  async lookup(
    ctx: RequestContext,
    input: AddressLookupInput
  ): Promise<OrderAddress[]> {
    let query = `${input.houseNumber} ${input.streetName}`;
    if (input.postalCode) {
      query += `, ${input.postalCode}`;
    }
    const result = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.input.apiKey,
          'X-Goog-FieldMask': 'places.addressComponents',
        },
        body: JSON.stringify({
          textQuery: query,
          regionCode: input.countryCode?.toLowerCase(),
        }),
      }
    );
    if (!result.ok) {
      throw new Error(
        `Google Places API returned status ${result.status}: ${result.statusText}`
      );
    }
    const jsonResult = (await result.json()) as GooglePlacesResponse;
    return (jsonResult.places ?? []).map((place) => {
      const streetNumber = place.addressComponents.find((comp) =>
        comp.types.includes('street_number')
      )?.longText;
      const route = place.addressComponents.find((comp) =>
        comp.types.includes('route')
      )?.longText;
      const city = place.addressComponents.find((comp) =>
        comp.types.includes('locality')
      )?.longText;
      const province = place.addressComponents.find((comp) =>
        comp.types.includes('administrative_area_level_1')
      )?.longText;
      const postalCode = place.addressComponents.find((comp) =>
        comp.types.includes('postal_code')
      )?.longText;
      const country = place.addressComponents.find((comp) =>
        comp.types.includes('country')
      );
      return {
        streetLine1: route,
        streetLine2: streetNumber,
        city: city,
        province: province,
        postalCode: postalCode,
        country: country?.longText,
        countryCode: country?.shortText || input.countryCode,
      };
    });
  }
}
