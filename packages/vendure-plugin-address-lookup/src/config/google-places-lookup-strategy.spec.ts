import { RequestContext } from '@vendure/core';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { AddressLookupInput } from '../generated/graphql';
import { GooglePlacesLookupStrategy } from './google-places-lookup-strategy';

type MockFetch = Mock<Parameters<typeof fetch>, ReturnType<typeof fetch>>;

describe('GooglePlacesLookupStrategy', () => {
  let strategy: GooglePlacesLookupStrategy;
  let mockFetch: MockFetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    strategy = new GooglePlacesLookupStrategy({
      supportedCountryCodes: ['DE'],
      apiKey: 'test-api-key',
    });
  });

  it('throws error when searching with only postalcode', () => {
    const input: AddressLookupInput = {
      countryCode: 'DE',
      postalCode: '1234AB',
    };

    const result = strategy.validateInput(input);
    expect(result).toBe('House number is required for lookup');
  });

  it('searches with housenumber and streetname returns multiple results', async () => {
    const input: AddressLookupInput = {
      countryCode: 'DE',
      houseNumber: '123',
      streetName: 'Test Street',
    };

    const mockResponse = {
      places: [
        {
          addressComponents: [
            {
              longText: '123',
              shortText: '123',
              types: ['street_number'],
            },
            {
              longText: 'Test Street',
              shortText: 'Test St',
              types: ['route'],
            },
            {
              longText: 'Berlin',
              shortText: 'Berlin',
              types: ['locality'],
            },
            {
              longText: 'Berlin',
              shortText: 'BE',
              types: ['administrative_area_level_1'],
            },
            {
              longText: 'Germany',
              shortText: 'DE',
              types: ['country'],
            },
            {
              longText: '10115',
              shortText: '10115',
              types: ['postal_code'],
            },
          ],
        },
        {
          addressComponents: [
            {
              longText: '123',
              shortText: '123',
              types: ['street_number'],
            },
            {
              longText: 'Test Street',
              shortText: 'Test St',
              types: ['route'],
            },
            {
              longText: 'Hamburg',
              shortText: 'Hamburg',
              types: ['locality'],
            },
            {
              longText: 'Hamburg',
              shortText: 'HH',
              types: ['administrative_area_level_1'],
            },
            {
              longText: 'Germany',
              shortText: 'DE',
              types: ['country'],
            },
            {
              longText: '20095',
              shortText: '20095',
              types: ['postal_code'],
            },
          ],
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const result = await strategy.lookup({} as RequestContext, input);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': 'test-api-key',
          'X-Goog-FieldMask': 'places.addressComponents',
        },
        body: JSON.stringify({
          textQuery: '123 Test Street',
          regionCode: 'de',
        }),
      }
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      streetLine1: 'Test Street',
      streetLine2: '123',
      city: 'Berlin',
      province: 'Berlin',
      postalCode: '10115',
      country: 'Germany',
      countryCode: 'DE',
    });
    expect(result[1]).toEqual({
      streetLine1: 'Test Street',
      streetLine2: '123',
      city: 'Hamburg',
      province: 'Hamburg',
      postalCode: '20095',
      country: 'Germany',
      countryCode: 'DE',
    });
  });

  it('searches with housenumber, streetname and postalcode returns one result', async () => {
    const input: AddressLookupInput = {
      countryCode: 'DE',
      houseNumber: '123',
      streetName: 'Test Street',
      postalCode: '10115',
    };

    const mockResponse = {
      places: [
        {
          addressComponents: [
            {
              longText: '123',
              shortText: '123',
              types: ['street_number'],
            },
            {
              longText: 'Test Street',
              shortText: 'Test St',
              types: ['route'],
            },
            {
              longText: 'Berlin',
              shortText: 'Berlin',
              types: ['locality'],
            },
            {
              longText: 'Berlin',
              shortText: 'BE',
              types: ['administrative_area_level_1'],
            },
            {
              longText: 'Germany',
              shortText: 'DE',
              types: ['country'],
            },
            {
              longText: '10115',
              shortText: '10115',
              types: ['postal_code'],
            },
          ],
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const result = await strategy.lookup({} as RequestContext, input);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': 'test-api-key',
          'X-Goog-FieldMask': 'places.addressComponents',
        },
        body: JSON.stringify({
          textQuery: '123 Test Street, 10115',
          regionCode: 'de',
        }),
      }
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      streetLine1: 'Test Street',
      streetLine2: '123',
      city: 'Berlin',
      province: 'Berlin',
      postalCode: '10115',
      country: 'Germany',
      countryCode: 'DE',
    });
  });
});
