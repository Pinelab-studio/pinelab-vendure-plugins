import {
  DefaultLogger,
  LogLevel,
  mergeConfig,
  OrderService,
  RequestContext,
  RequestContextService,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { addItem } from '../../test/src/shop-utils';
import { waitFor } from '../../test/src/test-helpers';
import { BetterSearchPlugin, defaultSearchConfig } from '../src';
import gql from 'graphql-tag';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      BetterSearchPlugin.init({
        mapToSearchDocument: (product, collections) => {
          const defaultDocument = defaultSearchConfig.mapToSearchDocument(
            product,
            collections
          );
          const productFacetValues = product.facetValues.map((fv) => fv.name);
          return {
            ...defaultDocument,
            facetValueNames: productFacetValues,
            productAsset: {
              id: 'mock',
              preview: 'mock-preview',
            },
          };
        },
        // Add facetValueNames to indexable fields
        indexableFields: {
          ...defaultSearchConfig.indexableFields,
          facetValueNames: 2,
        },
      }),
    ],
  });

  ({ server, adminClient, shopClient } = createTestEnvironment(config));
  await server.init({
    initialData,
    productsCsvPath: './test/search-products.csv',
  });
}, 30000);

afterAll(async () => {
  await server.destroy();
}, 100000);

it('Started the server', () => {
  expect(server.app.getHttpServer()).toBeDefined();
});

it('Returns all fields for exact match', async () => {
  const {
    betterSearch: { totalItems, items },
  } = await shopClient.query(SEARCH_QUERY, {
    input: {
      term: 'smartphone',
    },
  });
  expect(totalItems).toBe(1);
  expect(items.length).toBe(1);
  expect(items[0].productId).toBe('T_2');
  expect(items[0].slug).toBe('smartphone');
  expect(items[0].productName).toBe('Smartphone');
  expect(items[0].productAsset.id).toBe('T_mock');
  expect(items[0].productAsset.preview).toBe('mock-preview');
  expect(items[0].lowestPrice).toBe(89900);
  expect(items[0].lowestPriceWithTax).toBe(107880);
  expect(items[0].highestPrice).toBe(99900);
  expect(items[0].highestPriceWithTax).toBe(119880);
  expect(items[0].facetValueIds).toEqual(['T_1', 'T_5']);
  expect(items[0].collectionIds).toEqual(['T_3']);
  expect(items[0].collectionNames).toEqual(['Electronics']);
});

it('Finds by facet value name', async () => {
  const {
    betterSearch: { totalItems, items },
  } = await shopClient.query(SEARCH_QUERY, {
    input: {
      term: 'sports',
    },
  });
  expect(totalItems).toBe(3);
  expect(items.length).toBe(3);
  expect(items[0].productName).toBe('Yoga Mat');
  expect(items[1].productName).toBe('Dumbbells');
  expect(items[2].productName).toBe('Running Shoes');
});

it('Finds by suffix and facet value', async () => {
  // Searching for 'bell' finds 'dumbbells' and 'wallet', because wallet has 'Bellroy' as brand
  const {
    betterSearch: { totalItems, items },
  } = await shopClient.query(SEARCH_QUERY, {
    input: {
      term: 'bell',
    },
  });
  expect(totalItems).toBe(2);
  expect(items.length).toBe(2);
  expect(items[0].productName).toBe('Dumbbells');
  expect(items[1].productName).toBe('Wallet');
});

it('Finds by prefix', async () => {
  // Searching for 'dumb' finds 'dumbbells'
  const {
    betterSearch: { totalItems, items },
  } = await shopClient.query(SEARCH_QUERY, {
    input: {
      term: 'dumb',
    },
  });
  expect(totalItems).toBe(1);
  expect(items.length).toBe(1);
  expect(items[0].productName).toBe('Dumbbells');
});

it('Finds by partial variant names', async () => {
  // Searching for 'ainless' finds 'Coffee Maker' and 'Toaster', because they both have a variant with 'Stainless' in the name
  const {
    betterSearch: { totalItems, items },
  } = await shopClient.query(SEARCH_QUERY, {
    input: {
      term: 'ainless',
    },
  });
  expect(totalItems).toBe(2);
  expect(items.length).toBe(2);
  expect(items[0].productName).toBe('Toaster');
  expect(items[1].productName).toBe('Coffee Maker');
});

it('Finds by mistyped variant names', async () => {
  // Searching for 'ainless' finds 'Coffee Maker' and 'Toaster', because they both have a variant with 'Stainless' in the name
  const {
    betterSearch: { totalItems, items },
  } = await shopClient.query(SEARCH_QUERY, {
    input: {
      term: 'steinless',
    },
  });
  expect(totalItems).toBe(2);
  expect(items.length).toBe(2);
  expect(items[0].productName).toBe('Toaster');
  expect(items[1].productName).toBe('Coffee Maker');
});

it('Is case insensitive', async () => {
  const {
    betterSearch: { totalItems, items },
  } = await shopClient.query(SEARCH_QUERY, {
    input: {
      term: 'STaiNlESS',
    },
  });
  expect(totalItems).toBe(2);
  expect(items.length).toBe(2);
  expect(items[0].productName).toBe('Toaster');
  expect(items[1].productName).toBe('Coffee Maker');
});

it('Normalizes special characters', async () => {
  const {
    betterSearch: { totalItems, items },
  } = await shopClient.query(SEARCH_QUERY, {
    input: {
      term: 'ŠtÅinless',
    },
  });
  expect(totalItems).toBe(2);
  expect(items.length).toBe(2);
  expect(items[0].productName).toBe('Toaster');
  expect(items[1].productName).toBe('Coffee Maker');
});

const SEARCH_QUERY = gql`
  query Search($input: BetterSearchInput!) {
    betterSearch(input: $input) {
      totalItems
      items {
        productId
        slug
        productName
        productAsset {
          id
          preview
        }
        lowestPrice
        lowestPriceWithTax
        highestPrice
        highestPriceWithTax
        facetValueIds
        collectionIds
        collectionNames
      }
    }
  }
`;
