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

interface SearchResponse {
  totalItems: number;
  items: Array<{ slug: string; productName: string }>;
}
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

describe('Relevance', () => {
  async function search(query: string) {
    const result = await shopClient.query(SEARCH_QUERY, {
      input: { term: query },
    });
    return (result as { betterSearch: SearchResponse }).betterSearch;
  }

  /**
   * Searching for "apple" should not blindly reward documents that repeat the word "apple" many times.
   * A product like "Apple Banana Orange" that uses the term once in a richer context
   * should rank above a product that just says "Apple" five times in a row.
   *
   * This is the classic term-frequency saturation test: repeating a word
   * should have diminishing returns, not linear gains.
   */
  it('does not over-reward keyword repetition (query: "apple")', async () => {
    const { items } = await search('apple');
    const slugs = items.map((i) => i.slug);
    const d3 = slugs.indexOf('apple-banana-orange');
    const d1 = slugs.indexOf('apple');
    const d2 = slugs.indexOf('apple-repeated');
    expect(d1, 'apple should rank first').toBe(0);
    expect(d3, 'apple-banana-orange should rank second').toBe(1);
    expect(d2, 'apple-repeated should rank third').toBe(2);
  });

  it('does not over-reward keyword repetition with typo (query: "appel")', async () => {
    const { items } = await search('appel');
    const slugs = items.map((i) => i.slug);
    const d3 = slugs.indexOf('apple-banana-orange');
    const d1 = slugs.indexOf('apple');
    const d2 = slugs.indexOf('apple-repeated');
    expect(d1, 'apple should rank first').toBe(0);
    expect(d3, 'apple-banana-orange should rank second').toBe(1);
    expect(d2, 'apple-repeated should rank third').toBe(2);
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
    const slugs = items.map((i) => i.slug);
    const d1 = slugs.indexOf('wireless-mouse');
    const d2 = slugs.indexOf('wireless-mouse-usb');
    const d3 = slugs.indexOf('peripherals-history-wireless-mouse');
    expect(d1, 'wireless-mouse should rank first').toBe(0);
    expect(d2, 'wireless-mouse-usb should rank second').toBe(1);
    expect(d3, 'peripherals-history-wireless-mouse should rank third').toBe(2);
  });

  it('prefers concise matches with typo (query: "wireles mouse")', async () => {
    const { items } = await search('wireles mouse');
    const slugs = items.map((i) => i.slug);
    const d1 = slugs.indexOf('wireless-mouse');
    const d2 = slugs.indexOf('wireless-mouse-usb');
    const d3 = slugs.indexOf('peripherals-history-wireless-mouse');
    expect(d1, 'wireless-mouse should rank first').toBe(0);
    expect(d2, 'wireless-mouse-usb should rank second').toBe(1);
    expect(d3, 'peripherals-history-wireless-mouse should rank third').toBe(2);
  });

  /**
   * For the query "red leather shoes", a product that contains all three words
   * ("Red Leather Shoes") should rank first. A product with two of the three words
   * ("Leather Shoes") should come next. A product that repeats "red" four times
   * but is missing "leather" should rank last, because covering more distinct
   * query terms matters more than repeating one term many times.
   */
  it('rewards matching all query terms over repeating a single term (query: "red leather shoes")', async () => {
    const { items } = await search('red leather shoes');
    const slugs = items.map((i) => i.slug);
    const d2 = slugs.indexOf('red-leather-shoes');
    const d3 = slugs.indexOf('leather-shoes');
    const d1 = slugs.indexOf('red-repeated-shoes');
    expect(d2, 'red-leather-shoes should rank first').toBe(0);
    expect(d3, 'leather-shoes should rank second').toBe(1);
    expect(d1, 'red-repeated-shoes should rank third').toBe(2);
  });

  it('rewards matching all query terms with typo (query: "red lether shoes")', async () => {
    const { items } = await search('red lether shoes');
    const slugs = items.map((i) => i.slug);
    const d2 = slugs.indexOf('red-leather-shoes');
    const d3 = slugs.indexOf('leather-shoes');
    const d1 = slugs.indexOf('red-repeated-shoes');
    expect(d2, 'red-leather-shoes should rank first').toBe(0);
    expect(d3, 'leather-shoes should rank second').toBe(1);
    expect(d1, 'red-repeated-shoes should rank third').toBe(2);
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
    const slugs = items.map((i) => i.slug);
    const d3 = slugs.indexOf('quasar-telescope');
    const d2 = slugs.indexOf('quasar');
    const d1 = slugs.indexOf('telescope-repeated');
    expect(d3, 'quasar-telescope should rank first').toBe(0);
    expect(d2, 'quasar should rank second').toBe(1);
    expect(d1, 'telescope-repeated should rank third').toBe(2);
  });

  it('weights rare terms higher with typo (query: "quaser telescope")', async () => {
    const { items } = await search('quaser telescope');
    const slugs = items.map((i) => i.slug);
    const d3 = slugs.indexOf('quasar-telescope');
    const d2 = slugs.indexOf('quasar');
    const d1 = slugs.indexOf('telescope-repeated');
    expect(d3, 'quasar-telescope should rank first').toBe(0);
    expect(d2, 'quasar should rank second').toBe(1);
    expect(d1, 'telescope-repeated should rank third').toBe(2);
  });

  /**
   * A realistic e-commerce query: "nike running shoes". The product named
   * "Nike Running Shoes for Men" matches all three terms naturally and should rank first.
   * A product that stuffs the brand name ("Running Shoes by Nike Nike Nike Nike") should
   * rank below it, because keyword stuffing shouldn't be rewarded.
   * "Shoes for Running" only matches two of the three terms and misses the brand entirely,
   * so it should rank last.
   */
  it('ranks a natural product title above keyword-stuffed titles (query: "nike running shoes")', async () => {
    const { items } = await search('nike running shoes');
    const slugs = items.map((i) => i.slug);
    const d1 = slugs.indexOf('nike-running-shoes-men');
    const d2 = slugs.indexOf('running-shoes-nike-repeated');
    const d3 = slugs.indexOf('shoes-for-running');
    expect(d1, 'nike-running-shoes-men should rank first').toBe(0);
    expect(d2, 'running-shoes-nike-repeated should rank second').toBe(1);
    expect(d3, 'shoes-for-running should rank third').toBe(2);
  });

  it('ranks natural title above keyword-stuffed with typo (query: "nike runing shoes")', async () => {
    const { items } = await search('nike runing shoes');
    const slugs = items.map((i) => i.slug);
    const d1 = slugs.indexOf('nike-running-shoes-men');
    const d2 = slugs.indexOf('running-shoes-nike-repeated');
    const d3 = slugs.indexOf('shoes-for-running');
    expect(d1, 'nike-running-shoes-men should rank first').toBe(0);
    expect(d2, 'running-shoes-nike-repeated should rank second').toBe(1);
    expect(d3, 'shoes-for-running should rank third').toBe(2);
  });
});

describe('Filtering', () => {
  // TODO implement later, when we have decided on what search algorithm to use based on performance and relevance.
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
