import { RequestContext } from '@vendure/core';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { AddressLookupInput } from '../generated/graphql';
import { PostNLLookupStrategy } from './post-nl-lookup-strategy';

type MockFetch = Mock<Parameters<typeof fetch>, ReturnType<typeof fetch>>;

describe('PostNLLookupStrategy', () => {
  let strategy: PostNLLookupStrategy;
  let mockFetch: MockFetch;
  let ctx: RequestContext;

  beforeEach(() => {
    // Reset fetch mock before each test
    mockFetch = vi.fn() as MockFetch;
    global.fetch = mockFetch;
    strategy = new PostNLLookupStrategy({ apiKey: 'test-api-key' });
    ctx = {} as RequestContext;
  });

  describe('Input validation', () => {
    it.each([
      {
        name: 'NL lookup with incorrect postalcode',
        input: { countryCode: 'NL', postalCode: '123', houseNumber: '1' },
        expected: 'Postal code must be 4 numbers and 2 letters',
      },
      {
        name: 'NL lookup without housenumber',
        input: { countryCode: 'NL', postalCode: '1234AB', houseNumber: '' },
        expected: 'House number is required for lookup',
      },
      {
        name: 'BE lookup with incorrect postalcode',
        input: { countryCode: 'BE', postalCode: '123', houseNumber: '1' },
        expected: "Postal code for 'BE' code must be 4 numbers",
      },
      {
        name: 'BE lookup without housenumber',
        input: { countryCode: 'BE', postalCode: '1000', houseNumber: '' },
        expected: "House number is required for lookup in 'BE'",
      },
    ])('$name', ({ input, expected }) => {
      const result = strategy.validateInput?.(input as AddressLookupInput);
      expect(result).toBe(expected);
    });
  });

  describe('Address lookup', () => {
    it('finds address in NL', async () => {
      const mockResponse = [
        {
          streetName: 'Teststraat',
          cityName: 'Amsterdam',
          countryName: 'Netherlands',
          houseNumber: '1',
          stateName: 'Noord-Holland',
        },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await strategy.lookup(ctx, {
        countryCode: 'NL',
        postalCode: '1234AB',
        houseNumber: '1',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.postnl.nl/v2/address/benelux?countryIso=nl&houseNumber=1&postalCode=1234AB',
        expect.any(Object)
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        streetLine1: 'Teststraat',
        city: 'Amsterdam',
        country: 'Netherlands',
      });
    });

    it('looks up BE addresses without streetname as input', async () => {
      const mockResponse = [
        {
          streetName: 'Rue Test 1',
          cityName: 'Brussels',
          countryName: 'Belgium',
          houseNumber: '1',
          stateName: 'Brussels',
        },
        {
          streetName: 'Rue Test 2',
          cityName: 'Brussels',
          countryName: 'Belgium',
          houseNumber: '1',
          stateName: 'Brussels',
        },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);
      const result = await strategy.lookup(ctx, {
        countryCode: 'BE',
        postalCode: '1000',
        houseNumber: '1',
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.postnl.nl/v2/address/benelux?countryIso=be&houseNumber=1&postalCode=1000',
        expect.any(Object)
      );
      expect(result).toHaveLength(2);
    });

    it('looks up BE addresses with streetname as input', async () => {
      const mockResponse = [
        {
          streetName: 'Rue Specific',
          cityName: 'Brussels',
          countryName: 'Belgium',
          houseNumber: '1',
          stateName: 'Brussels',
        },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);
      const result = await strategy.lookup(ctx, {
        countryCode: 'BE',
        postalCode: '1000',
        houseNumber: '1',
        streetName: 'Rue Specific',
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.postnl.nl/v2/address/benelux?countryIso=be&houseNumber=1&postalCode=1000&streetName=Rue Specific',
        expect.any(Object)
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        streetLine1: 'Rue Specific',
        city: 'Brussels',
        country: 'Belgium',
      });
    });

    it('throws error on API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      await expect(
        strategy.lookup(ctx, {
          countryCode: 'NL',
          postalCode: '1234AB',
          houseNumber: '1',
        })
      ).rejects.toThrow('PostNL API returned status 400: Bad Request');
    });
  });
});
