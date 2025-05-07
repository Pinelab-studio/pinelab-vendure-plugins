import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import {
  DefaultLogger,
  InitialData,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import { TestServer } from '@vendure/testing/lib/test-server';
import { expect, describe, beforeAll, afterAll, it, afterEach } from 'vitest';
import { AddressLookupPlugin } from '../src/address-lookup.plugin';
import { PostcodeTechStrategy } from '../src/config/postcode-tech-strategy';
import gql from 'graphql-tag';
import { addItem } from '../../test/src/shop-utils';
import nock from 'nock';

describe('Address Lookup plugin', () => {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        port: 3106,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        AddressLookupPlugin.init({
          lookupStrategies: [
            new PostcodeTechStrategy({
              apiKey: 'test-api-key',
            }),
          ],
        }),
      ],
    });

    ({ server, adminClient, shopClient } = createTestEnvironment(config));
    await server.init({
      initialData: initialData as InitialData,
      productsCsvPath: '../test/src/products-import.csv',
    });
    serverStarted = true;
    await adminClient.asSuperAdmin();
  }, 60000);

  afterEach(() => {
    nock.cleanAll();
  });

  it('Should start successfully', async () => {
    await expect(serverStarted).toBe(true);
  });

  it('throws error when no active order', async () => {
    expect.assertions(1);
    try {
      await shopClient.query(gql`
        query {
          lookupAddress(
            input: { countryCode: "NL", postalCode: "1234AB", houseNumber: "1" }
          ) {
            streetLine1
            city
            postalCode
          }
        }
      `);
    } catch (e: any) {
      expect(e.response.errors[0].extensions.code).toBe('FORBIDDEN');
    }
  });

  it('throws error when no strategy found for country code XYZ', async () => {
    expect.assertions(2);
    await addItem(shopClient, 'T_1', 1);
    try {
      await shopClient.query(gql`
        query {
          lookupAddress(
            input: {
              countryCode: "XYZ"
              postalCode: "1234AB"
              houseNumber: "1"
            }
          ) {
            streetLine1
            city
            postalCode
          }
        }
      `);
    } catch (e: any) {
      expect(e.response.errors[0].extensions.code).toBe(
        'NO_ADDRESS_LOOKUP_STRATEGY_FOUND'
      );
      expect(e.response.errors[0].message).toBe(
        'No lookup strategy found for country code: xyz'
      );
    }
  });

  it.each([
    ['123', 'Postal code must be 4 numbers and 2 letters'],
    ['123456', 'Postal code must end with 2 letters'],
  ])(
    'throws error when invalid input for NL with postalcode %s',
    async (postalCode, expectedMessage) => {
      expect.assertions(2);
      await addItem(shopClient, 'T_1', 1);
      try {
        await shopClient.query(gql`
        query {
          lookupAddress(input: {
            countryCode: "NL"
            postalCode: "${postalCode}"
            houseNumber: "1"
          }) {
            streetLine1
            city
            postalCode
          }
        }
      `);
      } catch (e: any) {
        expect(e.response.errors[0].extensions.code).toBe(
          'INVALID_ADDRESS_LOOKUP_INPUT'
        );
        expect(e.response.errors[0].message).toBe(expectedMessage);
      }
    }
  );

  it('returns array of OrderAddress when results found', async () => {
    await addItem(shopClient, 'T_1', 1);

    const mockResponse = {
      postcode: '1234AB',
      number: '1',
      street: 'Test Street',
      city: 'Test City',
      municipality: 'Test Municipality',
      province: 'Test Province',
    };

    nock('https://postcode.tech')
      .get('/api/v1/postcode/full')
      .query({
        postcode: '1234AB',
        number: '1',
      })
      .reply(200, mockResponse);

    const { lookupAddress } = await shopClient.query(gql`
      query {
        lookupAddress(
          input: { countryCode: "NL", postalCode: "1234AB", houseNumber: "1" }
        ) {
          streetLine1
          city
          postalCode
          province
          country
        }
      }
    `);

    expect(lookupAddress).toEqual([
      {
        streetLine1: 'Test Street',
        city: 'Test City',
        postalCode: '1234AB',
        province: 'Test Province',
        country: 'Netherlands',
      },
    ]);
  });

  afterAll(async () => {
    await server.destroy();
  }, 100000);
});
