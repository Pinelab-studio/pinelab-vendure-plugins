import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { waitFor } from '../../test/src/test-helpers';
import { BetterSearchPlugin } from '../src';

interface BetterSearchResult {
  productId: string;
  slug: string;
  productName: string;
  lowestPrice: number;
  lowestPriceWithTax: number;
  highestPrice: number;
  highestPriceWithTax: number;
  facetValueIds: string[];
  collectionIds: string[];
  collectionNames: string[];
  skus: string[];
}

type SearchResponse = BetterSearchResult[];

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [BetterSearchPlugin.init({})],
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

describe('Relevance', () => {
  /**
   * Exact matches should rank higher than keyword repetition.
   */
  it('favors exact matches over keyword repetition (query: "apple")', async () => {
    const { items } = await search('apple');
    const slugs = items.map((i) => i.slug).slice(0, 3);
    expect(slugs).toEqual(['apple', 'apple-repeated', 'apple-banana-orange']);
  });

  it('favors exact matches over keyword repetition with typo (query: "appel")', async () => {
    const { items } = await search('appel');
    const slugs = items.map((i) => i.slug).slice(0, 3);
    expect(slugs).toEqual(['apple', 'apple-repeated', 'apple-banana-orange']);
  });

  /**
   * When searching for "wireless mouse", a product whose entire name is "Wireless Mouse"
   * should rank highest because it's a perfect, concise match. A slightly longer product
   * like "Wireless Mouse with USB Receiver" should come next. A very long product description
   * that buries "wireless mouse" deep inside a wall of text should rank lowest.
   *
   * Without length normalization, long documents tend to float up simply because
   * they contain more words — even when the match is incidental.
   */
  it('prefers concise, focused matches over long documents that mention the term in passing (query: "wireless mouse")', async () => {
    const { items } = await search('wireless mouse');
    const slugs = items.map((i) => i.slug).slice(0, 3);
    expect(slugs).toEqual([
      'wireless-mouse',
      'wireless-mouse-usb',
      'peripherals-history-wireless-mouse',
    ]);
  });

  it('prefers concise matches with typo (query: "wireles mouse")', async () => {
    const { items } = await search('wireles mouse');
    const slugs = items.map((i) => i.slug).slice(0, 3);
    expect(slugs).toEqual([
      'wireless-mouse',
      'wireless-mouse-usb',
      'peripherals-history-wireless-mouse',
    ]);
  });

  /**
   * For the query "red leather shoes", a product that contains all three words
   * ("Red Leather Shoes") should rank first. A product with two of the three words
   * in the correct order ("Leather Shoes") should come next.
   */
  it('rewards matching all query terms over repeating a single term (query: "red leather shoes")', async () => {
    const { items } = await search('red leather shoes');
    const slugs = items.map((i) => i.slug).slice(0, 3);
    expect(slugs).toEqual([
      'red-leather-shoes',
      'leather-shoes',
      'red-plastic-shoes',
    ]);
  });

  it('rewards matching all query terms with typo (query: "redd lether shoes")', async () => {
    const { items } = await search('redd lether shoes');
    const slugs = items.map((i) => i.slug).slice(0, 3);
    expect(slugs).toEqual([
      'red-leather-shoes',
      'leather-shoes',
      'red-plastic-shoes',
    ]);
  });

  /**
   * "Quasar" is a rare term that barely appears in the catalog, while "telescope" is more common.
   * When searching for "quasar telescope", the product that contains both words should rank first.
   * The product that only contains the rare word "quasar" should rank above the one that
   * just repeats the common word "telescope" three times.
   *
   * This validates that the search correctly weights rare/unique terms higher (IDF),
   * so niche products are findable and common-word spam doesn't dominate.
   */
  it('weights rare terms higher than common terms (query: "quasar telescope")', async () => {
    const { items } = await search('quasar telescope');
    const slugs = items.map((i) => i.slug).slice(0, 3);
    expect(slugs).toEqual(['quasar-telescope', 'quasar', 'telescope']);
  });

  it('weights rare terms higher with typo (query: "quasar teleskop")', async () => {
    const { items } = await search('quasar teleskop');
    const slugs = items.map((i) => i.slug).slice(0, 3);
    expect(slugs).toEqual(['quasar-telescope', 'quasar', 'telescope']);
  });

  /**
   * A realistic e-commerce query: "nike running shoes". The product named
   * "Nike Running Shoes for Men" matches all three terms naturally and should rank first.
   * "Shoes for Running" only matches two of the three terms and misses the brand entirely,
   * so it should rank last.
   */
  it('ranks a natural product title above keyword-stuffed titles (query: "nike running shoes")', async () => {
    const { items } = await search('nike running shoes');
    const slugs = items.map((i) => i.slug).slice(0, 2);
    expect(slugs).toEqual(['nike-running-shoes-men', 'shoes-for-running']);
  });

  it('ranks natural title above keyword-stuffed with typo (query: "nike runing shoes")', async () => {
    const { items } = await search('nike runing shoes');
    const slugs = items.map((i) => i.slug).slice(0, 2);
    expect(slugs).toEqual(['nike-running-shoes-men', 'shoes-for-running']);
  });

  /**
   * Search should be case insensitive: "APPLE" and "apple" should return the same
   * relevant results so users are not penalized for caps or caps lock.
   */
  it('is case insensitive (query: "APPLE")', async () => {
    const { items } = await search('APPLE');
    const slugs = items.map((i) => i.slug).slice(0, 3);
    expect(slugs).toEqual(['apple', 'apple-repeated', 'apple-banana-orange']);
  });

  /**
   * Search should ignore special characters and symbols.
   */
  it('supports special characters and symbols (query: "Äpple")', async () => {
    const { items } = await search('Äpple');
    const slugs = items.map((i) => i.slug).slice(0, 3);
    expect(slugs).toEqual(['apple', 'apple-repeated', 'apple-banana-orange']);
  });

  /**
   * Plural and singular forms should match: searching "apples" or "shoe" should
   * find documents that contain "apple" or "shoes", so users find products
   * without having to guess the exact form.
   */
  it('matches plural/singular forms (query: "apples")', async () => {
    const { items } = await search('apples');
    const slugs = items.map((i) => i.slug);
    expect(slugs).toEqual(['apple', 'apple-repeated', 'apple-banana-orange']);
  });

  /**
   * Partial word matches improve findability: "wire" should match "Wireless",
   * "run" should match "Running", so users get results without typing full words.
   */
  it('finds results with partial word match (query: "wire")', async () => {
    const { items } = await search('wire');
    const slugs = items.map((i) => i.slug);
    expect(slugs).toContain('wireless-mouse');
    expect(
      slugs.indexOf('wireless-mouse'),
      'concise match should rank first'
    ).toBe(0);
  });
});

// describe('Filtering', () => {
//   // TODO implement later, when we have decided on what search algorithm to use based on performance and relevance.
// });

const SEARCH_QUERY = gql`
  query Search($term: String!) {
    betterSearch(term: $term) {
      productId
      slug
      productName
      lowestPrice
      lowestPriceWithTax
      highestPrice
      highestPriceWithTax
      facetValueIds
      collectionIds
      collectionNames
      skus
    }
  }
`;

async function search(query: string) {
  const result = await shopClient.query(SEARCH_QUERY, { term: query });
  const items = (result as { betterSearch: SearchResponse }).betterSearch;
  return { items };
}
