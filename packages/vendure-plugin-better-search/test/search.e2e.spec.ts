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
import {
  BetterSearchPlugin,
  BetterSearchResult,
  defaultSearchConfig,
} from '../src';
import gql from 'graphql-tag';
import { searchConfig } from './search-config';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [BetterSearchPlugin.init(searchConfig)],
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
  const search = () =>
    shopClient.query(SEARCH_QUERY, {
      input: {
        term: 'smartphone',
      },
    });
  // First time we waitFor, because index needs to be built
  const result = await waitFor(async () => {
    try {
      const result = await search();
      if (result.betterSearch.items.length > 0) {
        return result;
      }
    } catch (error) {
      return undefined;
    }
  });
  const {
    betterSearch: { totalItems, items },
  } = result;
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
  expect(totalItems).toBe(6);
  expect(items.length).toBe(6);
  expect(
    items.find((item: BetterSearchResult) => item.productName === 'Yoga Mat')
  ).toBeDefined();
  expect(
    items.find((item: BetterSearchResult) => item.productName === 'Dumbbells')
  ).toBeDefined();
  expect(
    items.find(
      (item: BetterSearchResult) => item.productName === 'Running Shoes'
    )
  ).toBeDefined(); // Has 'black' as variant
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

it('Fetches all results', async () => {
  const {
    betterSearch: { totalItems, items },
  } = await shopClient.query(SEARCH_QUERY, {
    input: { term: 'pack', take: 100 },
  });
  expect(totalItems).toBe(5);
  expect(items.length).toBe(5);
  expect(items[0].productName).toBe('Backpack');
  expect(items[1].productName).toBe('Wallet'); // Has 'black' as variant
});

it('Fetches results 2 to 5', async () => {
  const {
    betterSearch: { totalItems, items },
  } = await shopClient.query(SEARCH_QUERY, {
    input: { term: 'pack', skip: 1, take: 4 },
  });
  expect(totalItems).toBe(5);
  expect(items.length).toBe(4);
  expect(items[0].productName).toBe('Wallet'); // Has 'black' as variant
});

it('Finds by partial variant names', async () => {
  // Searching for 'ainless' finds 'Coffee Maker' and 'Toaster', because they both have a variant with 'Stainless' in the name
  const {
    betterSearch: { items },
  } = await shopClient.query(SEARCH_QUERY, {
    input: {
      term: 'ainless',
    },
  });
  expect(items[0].productName).toBe('Coffee Maker');
  expect(items[1].productName).toBe('Toaster');
});

it('Finds by mistyped variant names', async () => {
  // 'Coffee Maker' and 'Toaster' both have a variant with 'Stainless' in the name
  const {
    betterSearch: { items },
  } = await shopClient.query(SEARCH_QUERY, {
    input: {
      term: 'steinless',
    },
  });
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
  expect(items[0].productName).toBe('Toaster');
  expect(items[1].productName).toBe('Coffee Maker');
});

it('Extended Graphql schema with custom fields', async () => {
  const {
    betterSearch: { items },
  } = await shopClient.query(gql`
    query Search {
      betterSearch(input: { term: "test" }) {
        items {
          productName
          facetValueNames
          customStaticField
        }
      }
    }
  `);
  expect(items[0].customStaticField).toBe('Some test value');
  expect(Array.isArray(items[0].facetValueNames)).toBe(true);
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
