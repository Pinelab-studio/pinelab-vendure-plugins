import {
  CurrencyCode,
  LanguageCode,
} from '@vendure/common/lib/generated-types';
import {
  DefaultLogger,
  EventBus,
  LogLevel,
  mergeConfig,
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
import { beforeAll, describe, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { waitFor } from '../../test/src/test-helpers';
import { BetterSearchPlugin } from '../src';
import { BetterSearchIndexEvent } from '../src/events/better-search-index.event';
import { IndexService } from '../src/services/index.service';
import {
  ASSIGN_PRODUCTS_TO_CHANNEL,
  CREATE_CHANNEL,
  GET_PRODUCTS,
  INSPECT_INDEX,
  INSPECT_SEARCH_INDEX,
  SEARCH_QUERY,
  SEARCH_SUGGESTIONS_QUERY,
  UPDATE_PRODUCT,
  WARMUP_QUERY,
} from './helpers';

/** Subset of Vendure's SearchResult we care about in these tests. */
interface SearchResultItem {
  productId: string;
  slug: string;
  productName: string;
  score: number;
}

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [BetterSearchPlugin.init({})],
  });

  // Listen for index build completion on the default channel before starting
  let defaultChannelIndexBuilt = false;
  ({ server, adminClient, shopClient } = createTestEnvironment(config));
  await server.init({
    initialData,
    productsCsvPath: './test/search-products.csv',
  });

  // Setup event listener for the default channel's index build
  const subscription = server.app
    .get(EventBus)
    .ofType(BetterSearchIndexEvent)
    .subscribe((e) => {
      if (
        e.ctx.channel.token === 'e2e-default-channel' &&
        e.numberOfProductsIndexed > 0 &&
        e.type === 'full'
      ) {
        defaultChannelIndexBuilt = true;
      }
    });

  // buildMissingIndexes runs before products are imported, so explicitly run
  // one full rebuild after import before testing partial updates.
  await adminClient.asSuperAdmin();
  const requestContextService = server.app.get(RequestContextService);
  const indexService = server.app.get(IndexService);
  const defaultCtx = await requestContextService.create({
    apiType: 'admin',
    channelOrToken: 'e2e-default-channel',
  });
  await indexService.triggerReindex(defaultCtx);

  // Wait for the index to be rebuilt with the imported products
  await waitFor(() => defaultChannelIndexBuilt, 300);
  subscription.unsubscribe();

  // Pre-warm the GraphQL/Nest pipeline with a dummy search so the first real
  // test doesn't pay schema-build / first-request latency.
  await shopClient.query(WARMUP_QUERY, { term: 'warmup' }).catch(() => {});
}, 60000);

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

describe('Partial reindexing', () => {
  it('indexes two products updated by concurrent mutations', async () => {
    await adminClient.asSuperAdmin();
    const productsResult = (await adminClient.query(GET_PRODUCTS)) as {
      products: { items: Array<{ id: string; slug: string; name: string }> };
    };
    const products = ['apple-repeated', 'apple-banana-orange'].map((slug) => {
      const product = productsResult.products.items.find(
        (item) => item.slug === slug
      );
      expect(product).toBeDefined();
      return product!;
    });

    await Promise.all(
      products.map((product, index) =>
        adminClient.query(UPDATE_PRODUCT, {
          input: {
            id: product.id,
            translations: [
              {
                languageCode: LanguageCode.en,
                name: `Concurrent Reindex Product ${index + 1}`,
                slug: product.slug,
                description: `Concurrent partial reindex test product ${
                  index + 1
                }.`,
              },
            ],
          },
        })
      )
    );

    const result = await waitFor(
      async () => {
        const response = (await shopClient.query(SEARCH_QUERY, {
          term: 'Concurrent Reindex Product',
        })) as { search: { items: SearchResultItem[] } };
        const resultIds = new Set(
          response.search.items.map((item) => item.productId)
        );
        return products.every((product) => resultIds.has(product.id))
          ? response.search.items.filter((item) =>
              products.some((product) => product.id === item.productId)
            )
          : undefined;
      },
      100,
      10000
    );

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.productName).sort()).toEqual([
      'Concurrent Reindex Product 1',
      'Concurrent Reindex Product 2',
    ]);
  });
});

describe('inspectSearchIndex', () => {
  beforeAll(async () => {
    await adminClient.asSuperAdmin();
  });

  it('returns stored documents with expected fields', async () => {
    const result = await adminClient.query(INSPECT_SEARCH_INDEX);
    const data = (
      result as unknown as { inspectSearchIndex: Record<string, unknown>[] }
    ).inspectSearchIndex;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('id');
    expect(data[0]).toHaveProperty('sku');
    expect(data[0]).toHaveProperty('productName');
  });
});

// describe('Filtering', () => {
//   // TODO implement later, when we have decided on what search algorithm to use based on performance and relevance.
// });

describe('searchSuggestions', () => {
  it('returns suggestions for a 2-letter term', async () => {
    const result = (await shopClient.query(SEARCH_SUGGESTIONS_QUERY, {
      term: 'ap',
    })) as {
      searchSuggestions: { suggestion: string }[];
    };
    expect(result.searchSuggestions.length).toBeGreaterThan(0);
    expect(result.searchSuggestions[0]).toHaveProperty('suggestion');
    expect(result.searchSuggestions[0].suggestion).toBeTruthy();
  });
});

describe('Multi-channel and multi-language', () => {
  let secondChannelId: string;
  let secondChannelToken: string;
  let appleProductId: string;

  beforeAll(async () => {
    await adminClient.asSuperAdmin();
    const createResult = (await adminClient.query(CREATE_CHANNEL, {
      input: {
        code: 'second-channel',
        token: 'second-channel',
        defaultLanguageCode: LanguageCode.en,
        defaultCurrencyCode: CurrencyCode.USD,
        defaultShippingZoneId: 1,
        defaultTaxZoneId: 1,
        pricesIncludeTax: true,
        availableLanguageCodes: [LanguageCode.en, LanguageCode.de],
        availableCurrencyCodes: [CurrencyCode.USD],
      },
    })) as { createChannel: { id: string; code: string; token: string } };
    secondChannelId = createResult.createChannel.id;
    secondChannelToken = createResult.createChannel.token;

    const productsResult = (await adminClient.query(GET_PRODUCTS)) as {
      products: { items: Array<{ id: string; slug: string; name: string }> };
    };
    const appleProduct = productsResult.products.items.find(
      (p) => p.slug === 'apple'
    );
    appleProductId = appleProduct!.id;

    // Wait for the second channel's index to be built after assigning products
    let secondChannelIndexBuilt = false;
    const subscription = server.app
      .get(EventBus)
      .ofType(BetterSearchIndexEvent)
      .subscribe((e) => {
        if (e.ctx.channel.token === secondChannelToken) {
          secondChannelIndexBuilt = true;
        }
      });

    await adminClient.query(ASSIGN_PRODUCTS_TO_CHANNEL, {
      input: {
        channelId: secondChannelId,
        productIds: [appleProductId],
      },
    });

    // New channels do not exist during bootstrap, so create their initial full index explicitly.
    adminClient.setChannelToken(secondChannelToken);
    const ctx = await server.app.get(RequestContextService).create({
      apiType: 'admin',
      channelOrToken: secondChannelToken,
    });
    await server.app.get(IndexService).triggerReindex(ctx);

    await waitFor(() => secondChannelIndexBuilt, 10000);
    subscription.unsubscribe();
  }, 30000);

  it('finds only products assigned to the second channel', async () => {
    shopClient.setChannelToken(secondChannelToken);
    adminClient.setChannelToken(secondChannelToken);

    const searchResult = (await shopClient.query(SEARCH_QUERY, {
      term: 'apple',
    })) as { search: { totalItems: number; items: SearchResultItem[] } };
    expect(searchResult.search.totalItems).toBeGreaterThan(0);
    expect(searchResult.search.items[0].slug).toBe('apple');

    const indexResult = await adminClient.query(INSPECT_INDEX, {
      skip: 0,
      take: 50,
    });
    const indexData = (
      indexResult as unknown as {
        inspectSearchIndex: Record<string, unknown>[];
      }
    ).inspectSearchIndex;
    expect(indexData.length).toBe(1);

    const wirelessResult = (await shopClient.query(SEARCH_QUERY, {
      term: 'wireless',
    })) as { search: { totalItems: number } };
    expect(wirelessResult.search.totalItems).toBe(0);
  }, 30000);

  it('finds translated products in the correct language', async () => {
    // Listen for events so we know when reindex
    let indexEvent: BetterSearchIndexEvent;
    const subscription = server.app
      .get(EventBus)
      .ofType(BetterSearchIndexEvent)
      .subscribe((e) => {
        if (e.ctx.languageCode === 'de' && e.type === 'partial') {
          indexEvent = e;
        }
      });

    await adminClient.query(UPDATE_PRODUCT, {
      input: {
        id: appleProductId,
        translations: [
          {
            languageCode: LanguageCode.en,
            name: 'Apple',
            slug: 'apple',
            description: 'Apple.',
          },
          {
            languageCode: LanguageCode.de,
            name: 'Apfel',
            slug: 'apfel',
            description: 'Apfel.',
          },
        ],
      },
    });

    const event = await waitFor(() => (!!indexEvent ? indexEvent : undefined));
    subscription.unsubscribe();
    expect(event.numberOfProductsIndexed).toBe(1);
    expect(event.type).toBe('partial');
    shopClient.setChannelToken(secondChannelToken);
    const germanResult = await shopClient.query(
      SEARCH_QUERY,
      {
        term: 'Apfel',
      },
      { languageCode: 'de' }
    );
    expect(germanResult.search.totalItems).toBeGreaterThan(0);
    expect(germanResult.search.items[0].slug).toBe('apfel');
  });
});

async function search(query: string): Promise<{ items: SearchResultItem[] }> {
  const result = await shopClient.query(SEARCH_QUERY, { term: query });
  const items = (result as { search: { items: SearchResultItem[] } }).search
    .items;
  return { items };
}
